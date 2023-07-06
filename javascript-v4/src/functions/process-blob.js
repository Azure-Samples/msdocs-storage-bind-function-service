const { app, input, output } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { ApiKeyCredentials } = require('@azure/ms-rest-js');
const { ComputerVisionClient } = require('@azure/cognitiveservices-computervision');
const sleep = require('util').promisify(setTimeout);

const STATUS_SUCCEEDED = "succeeded";
const STATUS_FAILED = "failed"

const imageExtensions = ["jpg", "jpeg", "png", "bmp", "gif", "tiff"];

async function analyzeImage(url) {

    try {

        const computerVision_ResourceKey = process.env.ComputerVisionKey;
        const computerVision_Endpoint = process.env.ComputerVisionEndPoint;

        const computerVisionClient = new ComputerVisionClient(
            new ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': computerVision_ResourceKey } }), computerVision_Endpoint);

        const contents = await computerVisionClient.analyzeImage(url, {
            visualFeatures: ['ImageType', 'Categories', 'Tags', 'Description', 'Objects', 'Adult', 'Faces']
        });

        return contents;

    } catch (err) {
        console.log(err);
    }
}
app.storageBlob('process-blob-image', { 
    path: 'images/{name}',
    connection: 'StorageConnection',
    handler: async (blob, context) => {

        context.log(`Storage blob 'process-blob-image' url:${context.triggerMetadata.uri}, size:${blob.length} bytes`);

        const blobUrl = context.triggerMetadata.uri;
        const extension = blobUrl.split('.').pop();

        if(!blobUrl) {
            // url is empty
            return;
        } else if (!extension || !imageExtensions.includes(extension.toLowerCase())){
            // not processing file because it isn't a valid and accepted image extension
            return;
        } else {
            //url is image
            const id = uuidv4().toString();
            const analysis = await analyzeImage(blobUrl);
            
            // `type` is the partition key 
            const dataToInsertToDatabase = {
                    id,
                    type: 'image',
                    blobUrl,
                    blobSize: blob.length,
                    ...analysis,
                    trigger: context.triggerMetadata
                }

            return dataToInsertToDatabase;
        }

        
    },
    return: output.cosmosDB({
        connection: 'CosmosDBConnection',
        databaseName:'StorageTutorial',
        containerName:'analysis'
    })
});