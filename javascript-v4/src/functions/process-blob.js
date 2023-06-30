const { app, input, output } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { ApiKeyCredentials } = require('@azure/ms-rest-js');
const { ComputerVisionClient } = require('@azure/cognitiveservices-computervision');
const sleep = require('util').promisify(setTimeout);

const STATUS_SUCCEEDED = "succeeded";
const STATUS_FAILED = "failed"

async function readFileUrl(url) {

    try {

        const computerVision_ResourceKey = process.env.ComputerVisionKey;
        const computerVision_Endpoint = process.env.ComputerVisionEndPoint;

        const computerVisionClient = new ComputerVisionClient(
            new ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': computerVision_ResourceKey } }), computerVision_Endpoint);

        const contents = await computerVisionClient.analyzeImage(url, {
            visualFeatures: ['ImageType', 'Categories', 'Tags', 'Description', 'Objects', 'Adult', 'Faces']
        });

        // // To recognize text in a local image, replace client.read() with readTextInStream() as shown:
        // let result = await computerVisionClient.read(url);

        // // Operation ID is last path segment of operationLocation (a URL)
        // let operation = result.operationLocation.split('/').slice(-1)[0];

        // // result.status is initially undefined, since it's the result of read
        // while (result.status !== STATUS_SUCCEEDED) {
        //     await sleep(1000);
        //     result = await computerVisionClient.getReadResult(operation);
        // }

        // let contents = "";

        // result.analyzeResult.readResults.map((page) => {
        //     page.lines.map(line => {
        //         contents += line.text + "\n\r"
        //     });
        // });
        return contents;

    } catch (err) {
        console.log(err);
    }
}
app.storageBlob('process-blob', {
    path: 'images/{name}',
    connection: 'StorageConnection',
    handler: async (blob, context) => {

        context.log(`Storage blob (Begin) url:${context.triggerMetadata.uri}, size:${blob.length} bytes`);

        const blobUrl = context.triggerMetadata.uri;
        if(!blobUrl) {
            console.log(`url is empty`);
            return;
        } else {
            console.log(`url is found`);

            const id = uuidv4().toString();
            context.log(`Id = ${id}`)

            context.log(`Image processed (begin)`);
            const textContext = await readFileUrl(blobUrl);
            context.log(`Image processed (end)`);
            
            const dataToInsertToDatabase = {
                    id,
                    ...textContext
                }
            console.log(dataToInsertToDatabase)
            return {
                dataToInsertToDatabase
            }
        }

        
    },
    return: output.cosmosDB({
        connectionStringSetting: 'CosmosDbConnectionString',
        databaseName:'ToDoList',
        collectionName:'Items',
        partitionKey: 'ImageAnalysis'

    })
});