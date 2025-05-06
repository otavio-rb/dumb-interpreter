const dispatchError = (message = "Unexpected Error", errorCode = 1) => {
  console.error(message);
  process.exit(errorCode);
}

module.exports = dispatchError;