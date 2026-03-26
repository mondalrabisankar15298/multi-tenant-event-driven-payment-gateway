#!/bin/bash
# Wait for Redpanda to be ready, then create the payments.events topic
echo "Waiting for Redpanda to be ready..."
until rpk cluster health --brokers redpanda:9092 2>/dev/null; do
    sleep 2
done

echo "Creating topic: payments.events"
rpk topic create payments.events \
    --brokers redpanda:9092 \
    --partitions 6 \
    --replicas 1 \
    --config retention.ms=604800000

echo "Topic created successfully!"
rpk topic describe payments.events --brokers redpanda:9092
