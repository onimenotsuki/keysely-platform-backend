export const logger = {
  logRequest: (req: Request) => {
    const headersObject = Object.fromEntries(req.headers);
    const headersJson = JSON.stringify(headersObject, null, 2);

    console.log(`Request headers:\n${headersJson}`);
  },
  info: (message: string, data?: unknown) => {
    if (data) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  },
  error: (message: string, error?: unknown) => {
    if (error) {
      console.error(message, error);
    } else {
      console.error(message);
    }
  },
  debug: (message: string, data?: unknown) => {
    if (data) {
      console.debug(message, data);
    } else {
      console.debug(message);
    }
  },
};
