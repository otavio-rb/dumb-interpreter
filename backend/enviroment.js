const dispatchError = require("../utils/dispatch.js");

class Environment {
  constructor(parent) {
    this.parent = parent;
    this.isGlobal = parent === undefined;
    this.variables = Object.create(null);
    this.constants = new Set();
  }

  resolveVariable(name) {
    if (name in this.variables) return this;
    if (this.parent) return this.parent.resolveVariable(name);
    dispatchError(`Cannot resolve '${name}' - it does not exist.`);
  }

  getVariable(name) {
    const env = this.resolveVariable(name);
    return env.variables[name];
  }

  static isFloat(n) {
    return Number(n) === n && n % 1 !== 0;
  }

  static isBoolean(value) {
    return typeof value === 'boolean' || 
           (typeof value === 'string' && ['true', 'false'].includes(value.toLowerCase()));
  }

  static verifyTypeCorrespondence(type, value) {
    if (value === null || value === undefined) return true;
    
    const baseType = type?.replace('_ARRAY_TYPE', '_TYPE') || type;
    
    const typeCheckers = {
      INTEGER_TYPE: (val) => Number.isInteger(val),
      FLOAT_TYPE: this.isFloat,
      STRING_TYPE: (val) => typeof val === 'string',
      BOOLEAN_TYPE: this.isBoolean,
      [type]: (val) => {
        if (type?.endsWith('_ARRAY_TYPE')) {
          if (!Array.isArray(val)) return false;
          return val.every(item => this.verifyTypeCorrespondence(baseType, item));
        }
        return true;
      }
    };

    const checker = typeCheckers[type] || typeCheckers[baseType];
    return checker ? checker(value) : true;
  }

  declareVariable(name, value, isConstant = false) {
    if (this.variables[name] !== undefined) {
      dispatchError(`Variable '${name}' is already declared`);
    }

    if (value && !this.constructor.verifyTypeCorrespondence(value.type, value.value)) {
      dispatchError(`Type mismatch: Cannot assign ${typeof value.value} to ${value.type} variable '${name}'`);
    }

    this.variables[name] = value;
    if (isConstant) this.constants.add(name);
  }

  reassignVariableValue(name, newValue, isArray = false, accessIdx = null) {
    const env = this.resolveVariable(name);

    if (env.constants.has(name)) {
      dispatchError(`Cannot reassign constant '${name}'`);
    }

    const declaredVariable = env.variables[name];
    
    if (isArray) {
      if (!Array.isArray(declaredVariable.value)) {
        dispatchError(`Variable '${name}' is not an array`);
      }
      if (!this.constructor.verifyTypeCorrespondence(
        declaredVariable.type.replace('_ARRAY_TYPE', '_TYPE'), 
        newValue.value
      )) {
        dispatchError(`Type mismatch: Cannot assign ${typeof newValue.value} to array elements of ${declaredVariable.type}`);
      }
    } else {
      if (!this.constructor.verifyTypeCorrespondence(declaredVariable.type, newValue?.value)) {
        dispatchError(`Type mismatch: Cannot assign ${typeof newValue?.value} to ${declaredVariable.type} variable '${name}'`);
      }
    }

    if (isArray && accessIdx !== null) {
      declaredVariable.value[accessIdx] = newValue.value;
      return { ...declaredVariable, value: declaredVariable.value };
    } else {
      env.variables[name] = newValue;
      return newValue;
    }
  }
}

module.exports = Environment;