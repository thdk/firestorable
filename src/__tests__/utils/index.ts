// Toggle logging to terminal:
const shouldLogToConsole = false;

export const logger = (message: string) => shouldLogToConsole && console.log(message);

export const waitAsync = (timeout: number) => {
    return new Promise(resolve => {
        setTimeout(resolve, timeout);
    });
};
