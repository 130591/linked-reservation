#!/bin/bash

# SQS queues setup script for LocalStack

SQS_ENDPOINT="http://localhost:4566"
REGION="us-east-1"

echo "Creating SQS queues in LocalStack..."

# Create queues
aws --endpoint-url=$SQS_ENDPOINT --region=$REGION sqs create-queue --queue-name "session.expired"
aws --endpoint-url=$SQS_ENDPOINT --region=$REGION sqs create-queue --queue-name "reservation.confirmed"
aws --endpoint-url=$SQS_ENDPOINT --region=$REGION sqs create-queue --queue-name "notifications"
aws --endpoint-url=$SQS_ENDPOINT --region=$REGION sqs create-queue --queue-name "conversation.reply"

echo "SQS queues created successfully!"

# List queues to verify
echo "Listing all queues:"
aws --endpoint-url=$SQS_ENDPOINT --region=$REGION sqs list-queues
