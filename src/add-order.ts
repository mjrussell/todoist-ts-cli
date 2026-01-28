export type AddOrder =
  | { kind: "top" }
  | { kind: "position"; position: number };

export type AddOrderOptions = {
  top?: boolean;
  order?: string;
};

export type AddOrderParseResult = {
  result?: AddOrder;
  error?: string;
};

const INTEGER_PATTERN = /^\d+$/;

export function parseAddOrder(options: AddOrderOptions): AddOrderParseResult {
  const orderValue = options.order?.trim();

  if (options.top && orderValue) {
    return { error: 'Use either "--top" or "--order <position>".' };
  }

  if (options.top) {
    return { result: { kind: "top" } };
  }

  if (!orderValue) {
    return {};
  }

  const normalizedOrder = orderValue.toLowerCase();
  if (normalizedOrder === "top") {
    return { result: { kind: "top" } };
  }

  if (!INTEGER_PATTERN.test(orderValue)) {
    return { error: 'Invalid --order value. Use "top" or a positive integer.' };
  }

  const position = Number.parseInt(orderValue, 10);
  if (position < 1) {
    return { error: 'Invalid --order value. Use "top" or a positive integer.' };
  }

  return { result: { kind: "position", position } };
}
