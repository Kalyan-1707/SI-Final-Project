var readline = require("readline");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const fs = require("fs");
const express = require('express');
const app = express();
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const axios = require('axios');

const options = {
    swaggerDefinition: {
        info: {
            title: 'Azure AI Speech API',
            version: '1.0.0',
            description: 'Azure AI Speech API',
        },
    },
    apis: ['./app.js'], // files containing annotations as above
};  

const specs = swaggerJsdoc(options);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));



const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.SPEECH_KEY, process.env.SPEECH_REGION);
speechConfig.speechRecognitionLanguage = "en-US";


// transcribe endpoint which takes  input .wav file as input and transcribes it response as text
/**
 * @swagger
 * /transcribe:
 *   post:
 *     summary: Transcribe an audio file
 *     description: |
 *       This API endpoint transcribes an audio file in .wav format. The audio file should be provided as a publicly accessible URL. For example, you can use https://filebin.net/tyz9u79mkyvdot23/Why_Reading__Books_.wav. You can also generate your own public link by uploading your .wav file to https://filebin.net/.
 *     parameters:
 *       - name: url
 *         in: query
 *         type: string
 *         description: URL of the .wav audio file
 *         required: true
 *         format: url
 *     produces:
 *       - application/text
 *     responses:
 *       200:
 *         description: Successful transcription
 *         schema:
 *           type: string
 *           example: "RECOGNIZED: Text=Transcribed text"
 *       400:
 *         description: Bad request or unrecognized speech
 *         schema:
 *           type: string
 *           example: "NOMATCH: Speech could not be recognized"
 *       499:
 *         description: Transcription canceled or error occurred
 *         schema:
 *           type: string
 *           example: "CANCELED: Reason=SpeechTimeout"
 *       500:
 *         description: Error retrieving audio file
 *         schema:
 *           type: string
 *           example: "Error retrieving audio file"
 */
app.post('/transcribe', async (req, res) => {
    const url = req.query.url;

    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const audioData = Buffer.from(response.data, 'binary');

        // create audio config
        let audioConfig = sdk.AudioConfig.fromWavFileInput(audioData);
        let speechRecognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);


        speechRecognizer.recognizeOnceAsync(result => {
            switch (result.reason) {
                case sdk.ResultReason.RecognizedSpeech:
                    // console.log("RECOGNIZED: Text=" + result.text);
                    res.send(`RECOGNIZED: Text=${result.text}`).status(200);
                    break;

                case sdk.ResultReason.NoMatch:
                    res.send("NOMATCH: Speech could not be recognized.").status(400);
                    break;

                case sdk.ResultReason.Canceled:
                    const cancellation = sdk.CancellationDetails.fromResult(result);
                    res.send(`CANCELED: Reason=${cancellation.reason}`).status(499);
                    break;
            }
            speechRecognizer.close();
        });
    } catch (error) {
        res.status(500).send('Error retrieving audio file');
    }
});


//endpoint which takes input text and converts it to speech
/**
 * @swagger
 * /speech:
 *   post:
 *     summary: Convert text to speech
 *     description: This endpoint accepts text in the request body and generates a corresponding audio file.
 *     parameters:
 *       - name: text
 *         in: query
 *         type: string
 *         description: Text to convert
 *         required: true
 *     produces:
 *       - audio/wav
 *     responses:
 *       200:
 *         description: Successful conversion
 *         schema:
 *           type: file
 *           example: YourAudioFile.wav
 *       499:
 *         description: Conversion canceled or error occurred
 *         schema:
 *           type: string
 *           example: "CANCELED: Reason=SpeechTimeout"
 *       500:
 *         description: Error converting text to speech
 *         schema:
 *           type: string
 *           example: "Error converting text to speech"
 */
app.post('/speech', (req, res) => {
    const text = req.query.text;
    var audioFile = "YourAudioFile.wav";
    const audioConfig = sdk.AudioConfig.fromAudioFileOutput(audioFile);

    // The language of the voice that speaks.
    speechConfig.speechSynthesisVoiceName = "en-US-AvaMultilingualNeural"; 

    // Create the speech synthesizer.
    var synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    

    synthesizer.speakTextAsync(text,
        function (result) {
      if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
        // console.log("synthesis finished.");
        res.download('YourAudioFile.wav');
      } else {
        // console.error("Speech synthesis canceled, " + result.errorDetails +
        //     "\nDid you set the speech resource key and region values?");
        res.send("Speech synthesis canceled, " + result.errorDetails).status(499);
      }
      synthesizer.close();
      synthesizer = null;
    },
        function (err) {
      console.trace("err - " + err);
      synthesizer.close();
      synthesizer = null;
    });
})


app.listen(3000, () => {
    console.log('Listening on port 3000');
})

