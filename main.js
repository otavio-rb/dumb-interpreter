#!/usr/bin/env node

const Lexer = require("./frontend/lexer");
const Parser = require("./frontend/parser");
const Enviroment = require("./backend/enviroment");
const Evaluator = require("./backend/evaluator");
const natives = require("./libs/native");
const path = require("path");
const fs = require("fs");

if (!process.argv[2]) {
  console.error("Error: File not found.")
  process.exit(1);
}

const source = path.resolve(__dirname, process.argv[2]);

fs.readFile(source, "utf8", (err, data) => {
  if (err) {
    console.error(err);
  }

  const lexer = new Lexer(data);
  const parser = new Parser(lexer.tokens);
  
  const globalScope = new Enviroment();
  globalScope.declareVariable("true", { type: "BOOLEAN", value: true }, true);
  globalScope.declareVariable("false", { type: "BOOLEAN", value: false }, true);
  globalScope.declareVariable("null", { type: "NULL", value: null }, true);
  globalScope.declareVariable("undefined", { type: "UNDEFINED", value: undefined }, true);
  globalScope.declareVariable("print", { type: "NATIVE_FUNCTION", value: natives.print }, true);
  globalScope.declareVariable("ask", { type: "NATIVE_FUNCTION", value: natives.ask }, true);
  globalScope.declareVariable("sleep", { type: "NATIVE_FUNCTION", value: natives.sleep }, true);
  globalScope.declareVariable("random", { type: "NATIVE_FUNCTION", value: natives.random }, true);
  globalScope.declareVariable("pow", { type: "NATIVE_FUNCTION", value: natives.pow }, true);
  globalScope.declareVariable("floor", { type: "NATIVE_FUNCTION", value: natives.floor }, true);
  globalScope.declareVariable("len", { type: "NATIVE_FUNCTION", value: natives.len }, true);
  globalScope.declareVariable("split", { type: "NATIVE_FUNCTION", value: natives.split }, true);
  globalScope.declareVariable("Number", { type: "NATIVE_FUNCTION", value: natives.Number }, true);
  globalScope.declareVariable("String", { type: "NATIVE_FUNCTION", value: natives.String }, true);
  globalScope.declareVariable("math", { type: "NATIVE_OBJECT", value: natives.math }, true);

  const evaluator = new Evaluator(parser.programPipeline.statements, globalScope);
});
