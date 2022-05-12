// ProcessImageUpload/index.js
const { v4: uuidv4 } = require('uuid');
const { ApiKeyCredentials } = require('@azure/ms-rest-js');
const { ComputerVisionClient } = require('@azure/cognitiveservices-computervision');
const sleep = require('util').promisify(setTimeout);

const STATUS_SUCCEEDED = "succeeded";
const STATUS_FAILED = "failed"

async function readFileUrl(context, computerVisionClient, url) {

    try {

        context.log(`uri = ${url}`);

        // To recognize text in a local image, replace client.read() with readTextInStream() as shown:
        let result = await computerVisionClient.read(url);

        // Operation ID is last path segment of operationLocation (a URL)
        let operation = result.operationLocation.split('/').slice(-1)[0];

        // Wait for read recognition to complete
        // result.status is initially undefined, since it's the result of read
        while (result.status !== STATUS_SUCCEEDED) {
            await sleep(1000);
            result = await computerVisionClient.getReadResult(operation);
        }

        let contents = "";

        result.analyzeResult.readResults.map((page) => {
            page.lines.map(line => {
                contents += line.text + "\n\r"
            });
        });
        return contents;

    } catch (err) {
        console.log(err);
    }
}

module.exports = async function (context, myBlob) {

    try {
        context.log("JavaScript blob trigger function processed blob \n Blob:", context.bindingData.blobTrigger, "\n Blob Size:", myBlob.length, "Bytes");

        const computerVision_ResourceKey = process.env.ComputerVisionKey;
        const computerVision_Endpoint = process.env.ComputerVisionEndPoint;

        const computerVisionClient = new ComputerVisionClient(
            new ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': computerVision_ResourceKey } }), computerVision_Endpoint);

        // URL must be full path
        const textContext = await readFileUrl(context, computerVisionClient, context.bindingData.uri);

        context.bindings.tableBinding = [];
        context.bindings.tableBinding.push({
            PartitionKey: "Images",
            RowKey: uuidv4().toString(),
            Text: textContext
        });
    } catch (err) {
        context.log(err);
        return;
    }

};
