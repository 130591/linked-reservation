const { SQSClient, CreateQueueCommand } = require('@aws-sdk/client-sqs')

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.SQS_BASE_URL || 'http://localhost:4566',
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY
  }
})

const queues = [
  'session_expired',
  'reservation_confirmed', 
  'notifications',
  'conversation_reply'
]

async function createQueues() {
  console.log('Creating SQS queues in LocalStack...')
  
  for (const queueName of queues) {
    try {
      const command = new CreateQueueCommand({
        QueueName: queueName
      })
      
      const result = await sqsClient.send(command)
      console.log(`Created queue: ${queueName}`)
      console.log(`URL: ${result.QueueUrl}`)
    } catch (error) {
      if (error.name === 'QueueAlreadyExists') {
        console.log(`Queue already exists: ${queueName}`)
      } else {
        console.error(`Error creating queue ${queueName}:`, error.message)
      }
    }
  }
  
  console.log('SQS setup complete!')
}

createQueues().catch(console.error)
