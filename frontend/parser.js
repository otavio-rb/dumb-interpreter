const RESERVED_KEYWORDS = require("./constants/RESERVED_KEYWORDS.js");
const dispatchError = require("../utils/dispatch.js");
const natives = require("../libs/native.js");

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.statements = [];
    this.programPipeline = { kind: "program", statements: [] };
    this._argumentDepth = 0;
    this._init();
  }

  _init() {
    while (!this._isFileEnd()) {
      this.statements.push(this._parseTypes());
    }

    this.programPipeline.statements = this.statements;
  }

  _eat() {
    return this.tokens.shift();
  }

  _currentToken() {
    return this.tokens[0];
  }

  _isFileEnd() {
    return this._currentToken()?.type === "ENDFILE";
  }

  _parseTypes() {
    const token = this._currentToken();

    if (!token) return;

    const typeHandlers = {
      INTEGER_ARRAY_TYPE: () => this._createTypedStatements(),
      STRING_ARRAY_TYPE: () => this._createTypedStatements(),
      FUNCTION_RETURN: () => this._parseReturnStatement(),
      BOOLEAN_TYPE: () => this._createTypedStatements(),
      INTEGER_TYPE: () => this._createTypedStatements(),
      STRING_TYPE: () => this._createTypedStatements(),
      FLOAT_TYPE: () => this._createTypedStatements(),
      NATIVE_FUNCTION: () => this._parseIdentifier(),
      CONSTANT: () => this._createTypedStatements(),
      IDENTIFIER: () => this._parseIdentifier(),
      IF_BLOCK: () => this._parseIfStatement(),
      FOR_LOOP: () => this._parseForLoop(),
      BREAK_EXEC: () => this._eat()
    };

    return typeHandlers[token.type]?.() || this._eat();
  }

  _createStatements() {
    return this._eat();
  }

  _createTypedStatements() {
    let typeToken = this._eat();

    if (!this._currentToken()) return;

    const isConstant = typeToken.type === "CONSTANT";

    // CONST -> IS A CONSTANT VARIABLE INDENTIFER TOKEN
    if (isConstant) typeToken = this._eat();

    const typeHandlers = {
      IDENTIFIER: () => this._parseVariableDeclaration(typeToken, isConstant),
      FUNCTION: () => this._parseFunctionDeclaration(typeToken),
    };

    return typeHandlers[this._currentToken().type]?.();
  }

  _parseForLoop() {
    this._eat(); // FOR

    if (this._eat().type !== "OPEN_PARENT")
      dispatchError("Expected a open parenthesis in loop statement");

    const loopVariableInitialization = this._createTypedStatements();
    const loopContinueCondition = this._parseBooleanComparison();
    
    if (this._currentToken().type === "SEMICOLON")
      this._eat();

    const loopVariableReassingment = this._parseIdentifier();

    this._expectToken("OPEN_BRACKET", "Expected an open bracket for loop body");

    const loopBody = [];
    let bracketCount = 1; // Já consumimos um OPEN_BRACKET

    while (bracketCount > 0 && !this._isFileEnd()) {
      const token = this._currentToken();

      if (token.type === "OPEN_BRACKET") {
        bracketCount++;
        this._eat();
        continue;
      }
      if (token.type === "CLOSE_BRACKET") {
        bracketCount--;
        if (bracketCount === 0) {
          this._eat();
          break;
        }
      }

      const statement = this._parseTypes();
      if (statement && statement.type !== "CLOSE_BRACKET" && statement.type !== "OPEN_BRACKET") {
        loopBody.push(statement);
      }
    }

    return {
      kind: "LOOP_STATEMENT",
      loop_continue_condition: loopContinueCondition,
      loop_variable_reassignment: loopVariableReassingment,
      loop_variable_initialization: loopVariableInitialization,
      loop_statements: loopBody
    };
  }

  _parseIdentifier(typeToken, isConstant) {
    const identifier = this._eat();

    if (this._currentToken().type === "OPEN_PARENT") {
      const args = this._parseCallerArguments();
      return this._parseFunctionCaller(identifier, args);
    }

    return this._parseVariableReassignment(typeToken, identifier, isConstant);
  }

  _parseArray(typeToken) {
    if (this._currentToken().type === "NATIVE_FUNCTION") {
      const identifier = this._eat();
      const args = this._parseCallerArguments();
      const caller = this._parseFunctionCaller(identifier, args);

      return {
        type: typeToken || "UNKNOW_ARRAY",
        value: caller
      };
    }

    if (this._eat().type !== "OPEN_SQUARE_BRACKET")
      dispatchError("Expected a open square bracket for array declaration")

    const items = this._getCallerArgs();

    return {
      type: typeToken || "UNKNOW_ARRAY",
      value: items
    };
  }

  _isArray(type) {
    return ["INTEGER_ARRAY_TYPE", "STRING_ARRAY_TYPE"].includes(type);
  }

  _parseVariableDeclaration(typeToken, isConstant) {
    if (!["INTEGER_TYPE", "INTEGER_ARRAY_TYPE", "STRING_ARRAY_TYPE", "STRING_TYPE", "FLOAT_TYPE", "BOOLEAN_TYPE"].includes(typeToken.type)) {
      dispatchError(`Error: Invalid variable type, ${typeToken.type}`);
    }

    const identifier = this._eat();
    if (identifier.type !== "IDENTIFIER" || this._isReservedIdentifier(identifier)) {
      dispatchError("Error: Invalid identifier");
    }

    let variableValue = null;
    if (this._currentToken().type === "EQUALS") {
      this._eat();
      if (this._isArray(typeToken.type)) {
        variableValue = this._parseArray(typeToken); // RETURNS A ARRAY -> []
      } else {
        variableValue = this._parseAssignmentExpression(typeToken); // RETURN A SCALAR VALUE
      }
    } else if (isConstant) {
      dispatchError("Erro: Constants must have a value");
    }

    if (this._currentToken().type === "SEMICOLON")
      this._eat();


    return { kind: "VARIABLE_DECLARATION", type: typeToken.type, value: variableValue, isConstant, name: identifier.value };
  }

  _parseVariableReassignment(typeToken, identifier) {
    // Verifica se é um acesso a array (ex: arr[0] = 5)
    if (this._currentToken().type === "OPEN_SQUARE_BRACKET") {
      const indexAccess = this._parseArrayIndexAccess(identifier);

      this._eat() // -> equals; 

      const value = this._parseAssignmentExpression();

      return {
        kind: "ARRAY_REASSIGNMENT",
        type: "UNKNOW",
        arrayName: identifier.value,
        index: indexAccess.index,
        value: value
      };
    } else {
      this._eat() // --> equals;
      
      const expr = this._parseAssignmentExpression();

      return {
        kind: "VARIABLE_REASSIGNMENT",
        type: expr.type,
        value: expr.value,
        name: identifier.value
      };
    }
  }

  _isReservedIdentifier(identifier) {
    return identifier.value in RESERVED_KEYWORDS;
  }

  _parseArrayIndexAccess(identifier) {
    this._eat(); // Consume '['

    const index = this._parseRPNExpression();

    if (this._eat().type !== "CLOSE_SQUARE_BRACKET")
      dispatchError("Expected closing square bracket for array access");

    return {
      kind: "ARRAY_ACCESS",
      arrayName: identifier.value,
      index: index
    };
  }

  _parseAssignmentExpression(typeToken) {
    return this._parseExpression(typeToken);
  }

  _parseExpression(typeToken) {
    if (this._currentToken().type === "OPEN_SQUARE_BRACKET") {
      return this._parseArray(typeToken);
    }

    if (this._isBooleanContext()) {
      return this._parseBooleanExpression();
    }

    return this._parseRPNExpression(typeToken);
  }

  _parseRPNExpression(typeToken) {
    const outputQueue = [], operatorStack = [], stringQueue = [];
    const precedence = { PLUS_OPERATOR: 1, MINUS_OPERATOR: 1, MULT_OPERATOR: 2, DIV_OPERATOR: 2, REST_OPERATOR: 2, EQUALS: 0 };
    const associativity = { PLUS_OPERATOR: "L", MINUS_OPERATOR: "L", MULT_OPERATOR: "L", DIV_OPERATOR: "L", REST_OPERATOR: "L", EQUALS: "R" };
    let hasStrings = false;
    let prevToken = null;
    // This could be more prettier  
    while (this.tokens.length > 0) {
      const token = this._currentToken();

      if (token.type === "STRING" || token.type === "STRING_TYPE") {
        hasStrings = true;
        outputQueue.push(this._eat());
        continue;
      }

      if (token.type === "IDENTIFIER" && this.tokens[1]?.type === "OPEN_PARENT") {
        const identifier = this._eat();
        const args = this._parseCallerArguments();
        const caller = this._parseFunctionCaller(identifier, args);
        outputQueue.push(caller);
        continue;
      }

      if (token.type === "NATIVE_FUNCTION") {
        const native = this._eat();
        const args = this._parseCallerArguments();

        const callerStatement = this._parseFunctionCaller(native, args);

        if (hasStrings) {
          stringQueue.push(callerStatement);
        } else {
          outputQueue.push(callerStatement);
        }

        prevToken = native;
      } else if (token.type === "STRING" || token.type === "STRING_TYPE") {
        stringQueue.push(this._eat())
      } else if (this._isArrayAccess()) {
        const identifier = this._eat();
        const arrayAccess = this._parseArrayIndexAccess(identifier);

        outputQueue.push(arrayAccess);
      } else if (token.type === "IDENTIFIER") {
          const identifier = this._eat();
          outputQueue.push(identifier);
      } else if (token.type === "NUMBER") {
        outputQueue.push(this._eat());
      } else if (this._isOperator(token)) {
        while (operatorStack.length && this._isOperator(operatorStack.at(-1)) &&
          ((associativity[token.type] === "L" && precedence[token.type] <= precedence[operatorStack.at(-1).type]) ||
            (associativity[token.type] === "R" && precedence[token.type] < precedence[operatorStack.at(-1).type]))) {
          outputQueue.push(operatorStack.pop());
        }
        operatorStack.push(this._eat());
      }
      else if (token.type === "OPEN_PARENT") {
        operatorStack.push(this._eat());
      } else if (token.type === "CLOSE_PARENT") {
        if (this._argumentDepth > 0) {
          break; // Sai do RPN e deixa o _parseCallerArguments lidar
        }

        while (operatorStack.length && operatorStack.at(-1).type !== "OPEN_PARENT") {
          outputQueue.push(operatorStack.pop());
        }
        // if (!operatorStack.length) dispatchError("Mismatched parentheses.");
        operatorStack.pop();
        this._eat();
      } else if (token.type === "SEMICOLON") {
        break;
      } else {
        break;
      }
    }

    while (operatorStack.length) {
      const op = operatorStack.pop();
      if (op.type === "OPEN_PARENT") dispatchError("Mismatched parentheses.");
      outputQueue.push(op);
    }

    return {
      type: hasStrings ? "STRING_EXPRESSION" : "NUMERIC_EXPRESSION",
      value: outputQueue
    };
  }

  _isBooleanContext() {
    for (let i = 0; i < this.tokens.length; i++) {
      const token = this.tokens[i];
      if (token.type === "SEMICOLON" || token.type === "CLOSE_PARENT") {
        break;
      }
      if (this._isLogicalOperator(token) || this._isComparisonOperator(token)) {
        return true;
      }
    }
    return false;
  }

  _parseBooleanExpression() {
    const expr = this._parseBooleanOR();

    return {
      kind: "BOOLEAN_EXPRESSION",
      value: expr
    };
  }

  _parseReturnStatement() {
    this._eat() // EAT RETURN TOKEN

    const value = this._parseAssignmentExpression();

    return {
      kind: "RETURN_STATEMENT",
      value
    }
  }

  _parseBooleanOR() {
    let left = this._parseBooleanAND();

    while (this._currentToken()?.type === "OR_OPERATOR") {
      const operator = this._eat();
      const right = this._parseBooleanAND();
      left = {
        type: "BOOLEAN_EXPRESSION",
        operator: operator.value,
        left,
        right
      };
    }

    return left;
  }

  _parseBooleanAND() {
    let left = this._parseBooleanComparison();

    while (this._currentToken()?.type === "AND_OPERATOR") {
      const operator = this._eat();

      const right = this._parseBooleanComparison();
      left = {
        type: "BOOLEAN_EXPRESSION",
        operator: operator.value,
        left,
        right
      };
    }

    return left;
  }

  _parseBooleanComparison() {
    const left = this._parseRPNExpression();

    
    if (this._isComparisonOperator(this._currentToken())) {
      const operator = this._eat();
      
      const right = this._parseRPNExpression();

      return {
        type: "BOOLEAN_EXPRESSION",
        operator: operator.value,
        left,
        right
      };
    }

    return left;
  }

  _parseBooleanFactor() {
    const token = this._currentToken();

    if (token.type === "NOT_OPERATOR") {
      this._eat();
      return {
        type: "UNARY_EXPRESSION",
        operator: "NOT",
        argument: this._parseBooleanFactor()
      };
    }

    if (token.type === "OPEN_PARENT") {
      this._eat();
      const expr = this._parseBooleanExpression();
      if (this._currentToken()?.type !== "CLOSE_PARENT") {
        dispatchError("Expected closing parenthesis");
      }
      this._eat();
      return expr;
    }

    if (token.type === "BOOLEAN") {
      return this._eat();
    }

    if (token.type === "IDENTIFIER") {
      return this._eat();
    }

    // If none of the above, try parsing as a numeric expression
    return this._parseRPNExpression();
  }

  _parseIfStatement() {
    this._eat(); // IF

    const conditionalExpression = this._parseIfConditionalExpression();

    this._expectToken("OPEN_BRACKET", "Expected '{' after if condition");

    const ifBlockBody = [];
    let bracketCount = 1;

    while (bracketCount > 0 && !this._isFileEnd()) {
      const token = this._currentToken();

      if (token.type === "OPEN_BRACKET") {
        bracketCount++;
      } else if (token.type === "CLOSE_BRACKET") {
        bracketCount--;
        if (bracketCount === 0) {
          this._eat(); // Consome o CLOSE_BRACKET final
          break;
        }
      }

      const statement = this._parseTypes();
      if (statement) ifBlockBody.push(statement);
    }

    return {
      kind: "IF_STATEMENT",
      body: ifBlockBody,
      conditional: conditionalExpression
    };
  }

  _parseFunctionDeclaration(typeToken) {
    this._eat(); // 'func' token

    const functionName = this._eat();
    if (!functionName || functionName.type !== "IDENTIFIER") {
      dispatchError("Error: Can't declare a function without a name.");
    }

    const args = this._parseFunctionArguments();

    this._expectToken("OPEN_BRACKET", "Expected '{' after function declaration");

    const functionBody = [];
    let functionReturn = null;
    let bracketCount = 1;

    while (bracketCount > 0 && !this._isFileEnd()) {
      const token = this._currentToken();

      if (token.type === "OPEN_BRACKET") {
        bracketCount++;
      } else if (token.type === "CLOSE_BRACKET") {
        bracketCount--;
        if (bracketCount === 0) {
          this._eat();
          break;
        }
      }

      const statement = this._parseTypes();
      if (statement) {
        functionBody.push(statement);
        if (statement.kind === "RETURN_STATEMENT") {
          functionReturn = statement;
        }
      }
    }

    if (bracketCount > 0) {
      dispatchError("Unclosed function block - missing '}'");
    }

    return {
      kind: "FUNCTION_DECLARATION",
      identifier: functionName.value,
      args,
      body: functionBody,
      return: functionReturn,
      type: typeToken.type
    };
  }

  _parseFunctionCaller(identifier, args) {
    return {
      kind: "FUNCTION_CALLER",
      type: "UNKNOW",
      isNative: !!natives[identifier.value],
      args,
      identifier: identifier.value
    }
  }

  _parseIfConditionalExpression() {
    this._expectToken("OPEN_PARENT", "Expected '(' after if");

    const conditional = this._parseBooleanExpression();

    return conditional;
  }

  _parseCallerArguments() {
    this._eat() // Open parenthesis -> (;
    this._argumentDepth++;

    const args = [];

    if (this._currentToken().type !== "CLOSE_PARENT") {
      args.push(this._parseAssignmentExpression());

      while (this._currentToken().type === "COMMA") {
        this._eat() // Comma;
        args.push(this._parseAssignmentExpression());
      }
    }

    this._expectToken("CLOSE_PARENT", "Expected closing parenthesis");
    this._argumentDepth--; 
    return args;
  }

  _parseFunctionArguments() {
    if (this._eat().type !== "OPEN_PARENT") dispatchError("Error: Expected open parenthesis.");

    if (this._currentToken().type === "CLOSE_PARENT")
      this._eat();

    return this._currentToken().type === "OPEN_BRACKET" ? [] : this._getArgs();
  }

  _getArgs() {
    const args = [this._eat()];

    while (this._currentToken().type === "COMMA" && this._eat()) {
      args.push(this._eat());
    }

    if (this._currentToken().type === "CLOSE_PARENT")
      this._eat();

    return args;
  }

  _getCallerArgs() {
    const expresison = this._parseAssignmentExpression(undefined, true);
    const args = [expresison];

    while (this._currentToken().type === "COMMA" && this._eat()) {
      const value = this._parseAssignmentExpression(undefined, true);

      args.push(value);
    }

    return args;
  }

  _expectToken(expectedType, errorMessage) {
    const currentToken = this._currentToken();
    if (!currentToken || currentToken.type !== expectedType) {
      dispatchError(`${errorMessage}. Found: ${currentToken?.type}`);
    }
    return this._eat();
  }

  _isArrayAccess() {
    if (this._currentToken()?.type !== "IDENTIFIER") {
      return false;
    }

    let lookahead = 1;
    let bracketCount = 0;

    while (lookahead < this.tokens.length) {
      const token = this.tokens[lookahead];

      if (token.type === "OPEN_SQUARE_BRACKET") {
        bracketCount++;
      } else if (token.type === "CLOSE_SQUARE_BRACKET") {
        bracketCount--;
        if (bracketCount === 0) {
          return true;
        }
      } else if (bracketCount === 0 &&
        (token.type === "SEMICOLON" || this._isOperator(token)) || this._isLogicalOperator(token) || this._isComparisonOperator(token)) {
        return false;
      }

      lookahead++;
    }

    return false;
  }

  _isExpressionTerminator() {
    const token = this._currentToken();

    return token.type === "SEMICOLON" ||
      token.type === "CLOSE_PARENT" ||
      token.type === "CLOSE_SQUARE_BRACKET" ||
      token.type === "COMMA";
  }

  _isOperator(token) {
    return token && ["PLUS_OPERATOR", "MINUS_OPERATOR", "MULT_OPERATOR", "DIV_OPERATOR", "REST_OPERATOR"].includes(token.type);
  }

  _isLogicalOperator(token) {
    return token && ["AND_OPERATOR", "OR_OPERATOR"].includes(token.type);
  }

  _isComparisonOperator(token) {
    return token && ["GT_OPERATOR", "LT_OPERATOR", "GTE_OPERATOR", "LTE_OPERATOR", "EQUAL_OPERATOR", "NOT_EQUAL_OPERATOR"].includes(token.type);
  }
}

module.exports = Parser;