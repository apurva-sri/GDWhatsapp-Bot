// Consistent API response formatter
const formatSuccess = (data, message = "Success") => {
  return {
    success: true,
    message,
    data,
  };
};

const formatError = (error, statusCode = 400) => {
  return {
    success: false,
    statusCode,
    error: error.message || error,
  };
};

module.exports = {
  formatSuccess,
  formatError,
};
