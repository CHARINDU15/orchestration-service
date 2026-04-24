const buildError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) {
    error.code = code;
  }
  return error;
};

module.exports = {
  buildError
};
