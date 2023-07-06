using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Azure.CognitiveServices.Vision.ComputerVision;
using Microsoft.Azure.CognitiveServices.Vision.ComputerVision.Models;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Host;
using Microsoft.Extensions.Logging;

namespace ProcessImage
{
    public class ProcessImage
    {
        // Azure Function name and output Binding to Table Storage
        [FunctionName("ProcessImageUpload")]
        [return: Table("ImageText", Connection = "StorageConnection")]
        // Trigger binding runs when an image is uploaded to the blob container below
        public async Task<ImageContent> Run([BlobTrigger("imageanalysis/{name}", Connection = "StorageConnection")]Stream myBlob, string name, ILogger log)
        {
            // Get connection configurations
            string subscriptionKey = Environment.GetEnvironmentVariable("ComputerVisionKey");
            string endpoint = Environment.GetEnvironmentVariable("ComputerVisionEndpoint");
            string imgUrl = $"https://{ Environment.GetEnvironmentVariable("StorageAccountName")}.blob.core.windows.net/imageanalysis/{name}";

            ComputerVisionClient client = new ComputerVisionClient(new ApiKeyServiceClientCredentials(subscriptionKey)) { Endpoint = endpoint };

            // Get the analyzed image contents
            var textContext = await AnalyzeImageContent(client, imgUrl);

            return new ImageContent { PartitionKey = "Images", RowKey = Guid.NewGuid().ToString(), Text = textContext };
        }
        public class ImageContent
        {
            public string PartitionKey { get; set; }
            public string RowKey { get; set; }
            public string Text { get; set; }
        }

        static async Task<string> AnalyzeImageContent(ComputerVisionClient client, string urlFile)
        {
            // Analyze the file using Computer Vision Client
            var textHeaders = await client.ReadAsync(urlFile);
            string operationLocation = textHeaders.OperationLocation;
            Thread.Sleep(2000);

            const int numberOfCharsInOperationId = 36;
            string operationId = operationLocation.Substring(operationLocation.Length - numberOfCharsInOperationId);

            // Read back the results from the analysis request
            ReadOperationResult results;
            do
            {
                results = await client.GetReadResultAsync(Guid.Parse(operationId));
            }
            while ((results.Status == OperationStatusCodes.Running ||
                results.Status == OperationStatusCodes.NotStarted));

            var textUrlFileResults = results.AnalyzeResult.ReadResults;

            // Assemble into readable string
            StringBuilder text = new StringBuilder();
            foreach (ReadResult page in textUrlFileResults)
            {
                foreach (Line line in page.Lines)
                {
                    text.AppendLine(line.Text);
                }
            }

            return text.ToString();
        }
    }
}
