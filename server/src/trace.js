// W3C traceparent (rule 14): one per request, one per hop. Shown in the trace list.
import { randomUUID } from 'node:crypto';

const byte = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0');

export function newTraceId() {
  return [...Array.from({ length: 16 }, byte)].join('');
}

export function newSpanId() {
  return [...Array.from({ length: 8 }, byte)].join('');
}

export function traceparent(traceId = newTraceId(), spanId = newSpanId()) {
  return `00-${traceId}-${spanId}-01`;
}

export function newHop(traceId) {
  return { traceparent: traceparent(traceId), spanId: traceparent().split('-')[2] };
}

export const requestId = randomUUID;
