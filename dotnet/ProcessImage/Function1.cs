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
    public class MyPoco
    {
        public string PartitionKey { get; set; }
        public string RowKey { get; set; }
        public string Text { get; set; }
    }

    public class Function1
    {
        [FunctionName("Function1")]
        [return: Table("ImageText", Connection = "StorageConnection")]
        public async Task<MyPoco> Run([BlobTrigger("testblobs/{name}", Connection = "StorageConnection")]Stream myBlob, string name, ILogger log)
        {
            log.LogInformation($"C# Blob trigger function Processed blob\n Name:{name} \n Size: {myBlob.Length} Bytes");

            string subscriptionKey = "your-subscription-key";
            string endpoint = "your-service-endpoint";

            string READ_TEXT_URL_IMAGE = $"your-img-url";

            ComputerVisionClient client = new ComputerVisionClient(new ApiKeyServiceClientCredentials(subscriptionKey)) { Endpoint = endpoint };

            var textContext = await ReadFileUrl(client, READ_TEXT_URL_IMAGE);

            return new MyPoco { PartitionKey = "Images", RowKey = Guid.NewGuid().ToString(), Text = textContext };
        }

        static async Task<string> ReadFileUrl(ComputerVisionClient client, string urlFile)
        {
            var textHeaders = await client.ReadAsync(urlFile);
            string operationLocation = textHeaders.OperationLocation;
            Thread.Sleep(2000);

            const int numberOfCharsInOperationId = 36;
            string operationId = operationLocation.Substring(operationLocation.Length - numberOfCharsInOperationId);

            ReadOperationResult results;
            do
            {
                results = await client.GetReadResultAsync(Guid.Parse(operationId));
            }
            while ((results.Status == OperationStatusCodes.Running ||
                results.Status == OperationStatusCodes.NotStarted));

            var textUrlFileResults = results.AnalyzeResult.ReadResults;

            StringBuilder text = new StringBuilder();
            foreach (ReadResult page in textUrlFileResults)
            {
                foreach (Line line in page.Lines)
                {
                    // Console.WriteLine(line.Text);
                    text.AppendLine(line.Text);
                }
            }

            return text.ToString();
        }
    }
}
