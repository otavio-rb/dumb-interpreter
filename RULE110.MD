# O que é a Regra 110?

A Regra 110 define como uma célula binária (com valor 0 ou 1) deve evoluir no tempo com base no seu próprio estado e nos estados de suas vizinhas imediatas (à esquerda e à direita).

Ela se baseia em todas as 8 possíveis combinações de três células (vizinha esquerda, célula atual e vizinha direita) e define o estado futuro da célula do meio para cada uma dessas combinações.

# | Vizinha Esquerda | Atual | Vizinha Direita | Próximo Estado |
# | ---------------- | ----- | --------------- | -------------- |
# | 1                | 1     | 1               | 0              |
# | 1                | 1     | 0               | 1              |
# | 1                | 0     | 1               | 1              |
# | 1                | 0     | 0               | 0              |
# | 0                | 1     | 1               | 1              |
# | 0                | 1     | 0               | 1              |
# | 0                | 0     | 1               | 1              |
# | 0                | 0     | 0               | 0              |