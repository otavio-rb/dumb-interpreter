const dispatchError = require("../utils/dispatch");
const Enviroment = require("./enviroment");
const natives = require("../libs/native");
const { func } = require("../frontend/constants/RESERVED_KEYWORDS");

class Evaluator {
  constructor(statements, scope) {
    this.statements = statements;
    this.scope = scope;
    this.evaluate_statements(this.statements);
  }

  async evaluate_statements(statements) {
    for (const statement of statements) {
      if (statement) {
        await this.handle_statement(statement);
      }
    }
  }

  async handle_statement(statement, scope = this.scope) {
    const handlers = {
      VARIABLE_DECLARATION: this.evaluate_variable_declaration,
      VARIABLE_REASSIGNMENT: this.evaluate_variable_reassignment,
      ARRAY_REASSIGNMENT: this.evaluate_array_reassignment,
      FUNCTION_DECLARATION: this.evaluate_function_declaration,
      LOOP_STATEMENT: this.evaluate_loop_block,
      FUNCTION_CALLER: this.evaluate_function_call,
      IF_STATEMENT: this.evaluate_if_block,
      RETURN_STATEMENT: this.evaluate_function_return
    };

    const handler = handlers[statement?.kind];
    return handler ? await handler.call(this, statement, scope) : null;
  }

  async evaluate_loop_block(statement, scope = this.scope) {
    const loopScope = new Enviroment(scope);

    const initStatement = statement.loop_variable_initialization;
    const varType = initStatement.type;

    const loopInitializeVariable = await this.evaluate_variable_declaration({
      ...initStatement,
      type: varType
    }, loopScope);

    const declaredLoopVariable = await loopScope.getVariable(initStatement.name);
    if (declaredLoopVariable.type !== varType) {
      dispatchError(`Type mismatch in loop variable '${initStatement.name}'. Expected ${varType}, got ${declaredLoopVariable.type}`);
    }

    let continueLoop = await this.evaluate_boolean_expression(statement.loop_continue_condition, loopScope);

    while (continueLoop.value) {
      let foundedABreakLoop = false;
      const loopBodyScope = new Enviroment(loopScope);

      for (const stm of statement.loop_statements) {
        if (stm?.type === "BREAK_EXEC") {
          foundedABreakLoop = true;
          continueLoop = { value: false, type: "BOOLEAN" };
          break;
        }

        await this.handle_statement(stm, loopBodyScope);
      }

      if (!foundedABreakLoop) {
        const reassignmentValue = await this.evaluate_node_value(
          statement.loop_variable_reassignment.value,
          varType,
          loopScope
        );

        if (reassignmentValue.type !== varType) {
          dispatchError(`Cannot assign ${reassignmentValue.type} to ${varType} variable '${initStatement.name}'`);
        }

        await loopScope.reassignVariableValue(
          initStatement.name,
          reassignmentValue
        );

        continueLoop = await this.evaluate_boolean_expression(
          statement.loop_continue_condition,
          loopScope
        );
      }
    }
  }

  async evaluate_if_block(statement, scope = this.scope) {
    const ifScope = new Enviroment(scope);
    const conditional = await this.evaluate_boolean_expression(statement.conditional.value, scope);

    if (Boolean(conditional.value)) {
      for (const stm of statement.body) {
        await this.handle_statement(stm, ifScope);
      }
    }
  }

  async evaluate_function_call(statement, scope = this.scope) {
    const declaredFunction = scope.getVariable(statement.identifier);

    const args = await this.evaluate_function_arguments(statement.args, scope);
    
    if (!statement.isNative) {
      const functionScope = new Enviroment(scope);

      await this.setup_function_arguments(declaredFunction, statement, functionScope);
      await this.execute_function_statements(declaredFunction, functionScope);
      const functionReturn = await this.evaluate_function_return(declaredFunction.return, functionScope)

      return functionReturn || null;
    }
    else {
      return await natives[statement.identifier](...(args || []));
    }
  }

  async evaluate_function_return(statement, scope = this.scope) {
    const { value } = await this.evaluate_node_value(statement.value.value, statement.value.type, scope);
    return value;
  }

  async setup_function_arguments(declaredFunction, statement, functionScope) {
    for (let i in declaredFunction.arguments) {
      const arg = declaredFunction.arguments[i];
      const statementArg = statement?.args[i];
      const argumentValue = (await this.evaluate_node_value(statementArg.value, statementArg.type, functionScope)) || null;
      functionScope.declareVariable(arg.value, argumentValue, false);
    }
  }

  async execute_function_statements(declaredFunction, functionScope) {
    for (const stm of declaredFunction.statements) {
      if (stm?.kind === "RETURN_STATEMENT")
        break;
      await this.handle_statement(stm, functionScope);
    }
  }

  async evaluate_function_arguments(args = [], scope = this.scope) {
    return Promise.all(args.map(async (arg) => {
      const { value } = await this.evaluate_node_value(arg.value, arg?.type || arg?.kind, scope);
      return value;
    }));
  }

  async evaluate_function_declaration(statement, scope = this.scope) {
    const functionPipeline = {
      isNative: !!natives[statement.name],
      statements: statement.body,
      arguments: statement.args,
      return: statement.return,
      type: statement.type,
    };

    scope.declareVariable(statement.identifier, functionPipeline);
  }

  async evaluate_array(values, type, scope = this.scope) {
    if(values.kind === "FUNCTION_CALLER"){
      const returnedArray = await this.evaluate_function_call(values, scope);
      return {
        type,
        value: returnedArray
      };
    }

    const evaluatedItems = await Promise.all(
      values.map(item => this.evaluate_node_value(item.value, item.type, scope))
    );

    return {
      type,
      value: evaluatedItems.map(item => item.value)
    };
  }

  async evaluate_node_value(nodeValue, nodeType, scope = this.scope) {
    const evaluators = {
      IDENTIFIER: this.evaluate_identifier,
      INTEGER_TYPE: this.evaluate_numeric_expression,
      FLOAT_TYPE: this.evaluate_numeric_expression,
      NUMERIC_EXPRESSION: this.evaluate_numeric_expression,
      BOOLEAN_TYPE: this.evaluate_boolean_expression,
      BOOLEAN_EXPRESSION: this.evaluate_boolean_expression,
      INTEGER_ARRAY_TYPE: this.evaluate_array,
      STRING_ARRAY_TYPE: this.evaluate_array,
      STRING_TYPE: this.evaluate_string_expression,
      STRING_EXPRESSION: this.evaluate_string_expression,
      STRING: this.evaluate_string_expression,
      ARRAY_ACCESS: this.evaluate_array_access,
    };

    const evaluator = evaluators[nodeType];
    if (evaluator) {
      return evaluator.call(this, nodeValue, nodeType, scope);
    }
    return { value: nodeValue?.value || nodeValue, type: nodeType };
  }

  async evaluate_array_access(node, type, scope = this.scope) {
    const array = await this.evaluate_identifier(node.arrayName, scope);
    const index = await this.evaluate_node_value(node.index.value, node.index.type, scope);


    if (!array || !array.value) {
      dispatchError(`Array ${node.arrayName} não definido`);
    }

    if (index.value >= array.value.length || index.value < 0) {
      dispatchError(`Índice ${index.value} fora dos limites do array`);
    }

    return {
      value: array.value[index.value],
      type: array.type.replace('ARRAY_TYPE', 'TYPE') // Converte "INTEGER_ARRAY_TYPE" para "INTEGER_TYPE"
    };
  }

  async evaluate_boolean_expression(expr, scope = this.scope) {
    const evaluate = async (node) => {
      if (!node) return false;
      switch (node.type) {
        case 'BOOLEAN_EXPRESSION':
          return await this.evaluate_boolean_expression(node, scope);
        case 'NUMERIC_EXPRESSION':
          const numericResult = await this.evaluate_numeric_expression(node.value, node.type, scope);
          return numericResult.value;
        case 'IDENTIFIER':
          const idResult = await this.evaluate_identifier(node.value, scope);
          return idResult?.value;
        case "STRING_EXPRESSION":
          const string = await this.evaluate_string_expression(node.value, node.type, scope)

          return string.value;
        case 'INTEGER_TYPE':
        case 'FLOAT_TYPE':
          const numResult = await this.evaluate_node_value(node.value, node.type, scope);
          return numResult?.value;
        default:
          return node.value;
      }
    };

    if (!expr.left && !expr.right) {
      const { value } = await this.evaluate_node_value(expr.value, expr.type, scope);
      return { value: Boolean(value), type: "BOOLEAN_TYPE" };
    }

    const left = expr.left ? await evaluate(expr.left) : null;
    const right = expr.right ? await evaluate(expr.right) : null;

    const operations = {
      '&&': () => Boolean(left && right),
      '||': () => Boolean(left || right),
      '!': () => !left,
      '>': () => left > right,
      '<': () => left < right,
      '>=': () => left >= right,
      '<=': () => left <= right,
      '==': () => left === right,
      '!=': () => left !== right,
    };

    if (operations[expr.operator]) {
      return { value: operations[expr.operator](), type: 'BOOLEAN_TYPE' };
    }

    dispatchError(`Operador booleano não suportado: ${expr.operator}`);
  }

  async evaluate_numeric_expression(nodes, variableType, scope = this.scope) {
    const stack = [];
    const operators = {
      PLUS_OPERATOR: (a, b) => a + b,
      MINUS_OPERATOR: (a, b) => a - b,
      MULT_OPERATOR: (a, b) => a * b,
      DIV_OPERATOR: (a, b) => a / b,
      REST_OPERATOR: (a, b) => a % b,
    };

    for (const token of nodes) {
      if (token?.kind === "FUNCTION_CALLER") {
        const callerResult = await this.evaluate_function_call(token, scope);
        stack.push(Number(callerResult));
      } else if (token.type === "IDENTIFIER") {
        const variable = await this.evaluate_identifier(token.value, scope);
        stack.push(variable?.value);
      } else if (token.kind === "ARRAY_ACCESS") {
        const evaluatedArrayAccess = await this.evaluate_array_access(token, "", scope);
        stack.push(evaluatedArrayAccess.value);
      } else if (token.type === "NUMBER") {
        stack.push(Number(token.value));
      } else if (operators[token.type]) {
        const right = stack.pop();
        const left = stack.pop();
        stack.push(operators[token.type](left, right));
      } else {
        dispatchError(`Error: expected a number or variable, ${token.value}`);
      }
    }

    return { value: stack.pop(), type: variableType };
  }

  async evaluate_string_expression(nodes, variableType, scope = this.scope) {
    let string = "";
    for (const node of nodes) {
      if (node?.kind === "FUNCTION_CALLER") {
        const functionCallResult = await this.evaluate_function_call(node, scope); 
        string += String(functionCallResult);
      } else if (node.type === "IDENTIFIER") {
        const identifier = await this.evaluate_identifier(node.value, scope);
        string += identifier.value;
      } else if (node?.type === "STRING" || node?.type === "STRING_TYPE") {
        string += node.value;
      }
    }

    return { type: variableType, value: string.replaceAll('"', "") };
  }

  async evaluate_identifier(nodeValue, scope = this.scope) {
    return scope.getVariable(nodeValue);
  }

  async evaluate_variable_declaration(statement, scope = this.scope) {
    const isArrayAccess = statement.value.kind === "ARRAY_ACCESS";
    const statementValue = isArrayAccess ? statement.value : statement.value.value;

    const value = statement.value
      ? await this.evaluate_node_value(statementValue, isArrayAccess ? statement.value.kind : statement.type, scope)
      : null;

    return scope.declareVariable(statement.name, value, statement.isConstant);
  }

  async evaluate_array_reassignment(statement, scope = this.scope) {
    const accessIndex = await this.evaluate_node_value(statement.index.value, statement.index.type, scope);
    const value = await this.evaluate_node_value(statement?.value?.value || statement.value, statement.value.type, scope);
    return scope.reassignVariableValue(statement.arrayName, value, true, accessIndex.value);
  }

  async evaluate_variable_reassignment(statement, scope = this.scope) {
    const declaredVariable = scope.getVariable(statement.name);

    const value = statement.value
      ? await this.evaluate_node_value(statement?.value, declaredVariable.type, scope)
      : null;

    return scope.reassignVariableValue(statement.name, value);
  }
}

module.exports = Evaluator;