// services/analytics-consumer/src/consumer.ts
//
// Kafka consumer на topic `events`. Batched processing.

import { Kafka } from 'kafkajs';
import { writeBatch } from './writer';

export async function startConsumer(): Promise<void> {
  const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || 'langton-arena',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  });

  const consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID || 'analytics-consumer' });
  await consumer.connect();
  await consumer.subscribe({ topic: 'events', fromBeginning: false });

  const batch: unknown[] = [];
  const FLUSH_SIZE = 1000;
  const FLUSH_INTERVAL_MS = 2000;

  setInterval(() => {
    if (batch.length > 0) {
      const toWrite = batch.splice(0, batch.length);
      void writeBatch(toWrite);
    }
  }, FLUSH_INTERVAL_MS);

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const parsed: unknown = JSON.parse(message.value!.toString());
        batch.push(parsed);
        if (batch.length >= FLUSH_SIZE) {
          const toWrite = batch.splice(0, batch.length);
          void writeBatch(toWrite);
        }
      } catch (err) {
        console.error('Bad event message', err);
      }
    },
  });
}
