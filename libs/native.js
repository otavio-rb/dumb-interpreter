const readline = require("readline");

const natives = {
  print(...params) {
    console.log(...params);
  },
  math: Math,
  random() {
    return Math.random();
  },

  pow(x, y) {
    return Math.pow(x, y);
  },

  floor(num) {
    return Math.floor(num);
  },

  len(array) {
    return array?.length || 0;
  },

  Number(string) {
    return Number(string);
  },
  
  String(number){
    return String(number);
  },

  split(str, separator, limit = undefined) {
    return str.split(separator, limit);
  },

  ask(questionText) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(questionText, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  },

  //Time in miliseconds
  sleep(timeInMiliseconds) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve();
      }, timeInMiliseconds);
    })
  },

  toLowerCase(string) {
    return string.toLowerCase();
  },

  toUpperCase(string) {
    return string.toUpperCase();
  }
};

module.exports = natives;