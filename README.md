8# Interpretador de Linguagem Própria

## Motivação

Sempre tive curiosidade em entender como funcionam interpretadores e linguagens de programação por baixo dos panos. Para explorar esse universo, decidi criar minha **própria linguagem de programação** e um **interpretador simples** para ela. Foi uma jornada prática e desafiadora, que me permitiu entender conceitos fundamentais da computação.

## Turing Completude

Minha linguagem é **Turing completa**, o que significa que ela possui a mesma capacidade computacional de uma máquina de Turing. Para comprovar isso, implementei nela o **autômato celular conhecido como Regra 110**, que é matematicamente reconhecido como Turing completo.

A execução da Regra 110 na linguagem prova que ela é capaz de realizar qualquer computação computacionalmente possível, dentro dos limites da memória disponível.

## Recursos da Linguagem

- Sintaxe imperativa de fácil compreensão
- Tipos básicos: `int`, `str`, `bool`, `strArray`, `intArray`
- Suporte a:
  - Funções com parâmetros e retorno
  - Laços (`loop`)
  - Condicionais (`if`)
  - Operações matemáticas e lógicas
  - Manipulação de arrays e strings (Matrizes ainda não suportadas)

## Exemplos de Código

### Conversão de Base (Hexadecimal para Decimal)

```c
int func convertToDecimal(input, base) {
  strArray tokens = split(input, "");
  int decimalNumber = 0;

  loop(int i = 0; i < len(tokens); i = i + 1){
    if(tokens[i] == "A"){ tokens[i] = 10; }
    if(tokens[i] == "B"){ tokens[i] = 11; }
    if(tokens[i] == "C"){ tokens[i] = 12; }
    if(tokens[i] == "D"){ tokens[i] = 13; }
    if(tokens[i] == "E"){ tokens[i] = 14; }
    if(tokens[i] == "F"){ tokens[i] = 15; }
    tokens[i] = Number(tokens[i]);
  }

  loop(int i = 0; i < len(tokens); i = i + 1){
    int digit = tokens[len(tokens) - 1 - i];
    int poweredNumber = pow(base, i);
    int newNumber = poweredNumber * digit;
    decimalNumber = newNumber + decimalNumber;
  }

  return decimalNumber;
}
```

### Conversão de Base (Hexadecimal para Decimal)

```c
str func convertToBinary(num){
  str binaryOutput = "";
  loop(int i = 0; num > 0; i = i + 1) {
    binaryOutput = num % 2 + binaryOutput;
    num = floor(num / 2);
  }
  print(binaryOutput);
  return binaryOutput;
}
```

### Conversão de Decimal para Binário
```c
str func convertToBinary(num){
  str binaryOutput = "";
  loop(int i = 0; num > 0; i = i + 1) {
    binaryOutput = num % 2 + binaryOutput;
    num = floor(num / 2);
  }
  print(binaryOutput);
  return binaryOutput;
}
```

## Como Executar
Clone este repositório:
```bash
git clone https://github.com/otavio-rb/dumb-interpreter
cd seu-repo
dumb hello.dumb
```
É necessário que o [Node.js](https://nodejs.org/pt) esteja instalado na sua máquina

## Suporte para Vs Code

Para facilitar a escrita de código na linguagem, o repositório inclui uma extensão do VS Code que adiciona realce de sintaxe e coloração personalizada.

### Instalação da Extensão
Certifique-se de ter o VS Code instalado.

Navegue até a pasta do projeto onde está o arquivo Dumb-0.0.1.vsix.

Execute o comando abaixo no terminal:
```bash
code --install-extension ./Dumb-0.0.1.vsix
```
