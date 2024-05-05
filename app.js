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


//endpoint which takes input audio file, recognizes and translates the text and returns json response sample file 'https://filebin.net/tyz9u79mkyvdot23/Why_Reading__Books_.wav'
/**
 * @swagger
 * /translate:
 *   post:
 *     summary: Translate audio file to text
 *     description: This endpoint accepts an audio file URL as a query parameter, retrieves the audio, recognizes the speech, and translates it to the specified target language. A successful response contains a JSON object with the original text and translated text in both languages. Example https://filebin.net/tyz9u79mkyvdot23/Why_Reading__Books_.wav. use filebin.net to upload audio file and get url.
 *     parameters:
 *       - in: query
 *         name: url 
 *         description: URL of the audio file to be translated.
 *         required: true
 *         type: string
 *     responses:
 *       '200':
 *         description: Translation successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 originalText:
 *                   type: object
 *                   properties:
 *                     text:
 *                       type: string
 *                       description: Recognized text in source language
 *                     language:
 *                       type: string
 *                       description: Source language (en-US in this example)
 *                 translation:
 *                   type: object
 *                   properties:
 *                     text:
 *                       type: string
 *                       description: Translated text in target language
 *                     language:
 *                       type: string
 *                       description: Target language
 *                 example:
 *                     {
 *                       "originalText": {
 *                         "text": "Why reading books?",
 *                         "language": "en-US"
 *                       },
 *                       "translation": {
 *                         "text": "Why reading books?",
 *                         "language": "en-US"
 *                       }
 *                     }
 *       '400':
 *         description: Speech recognition failed or missing required parameter
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message indicating the issue
 *       '499':
 *         description: Translation cancelled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Reason for translation cancellation
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message indicating server-side issue
 */         
app.post('/translate', async (req, res) => {
    const url = req.query.url;

    try {
          // This example requires environment variables named "SPEECH_KEY" and "SPEECH_REGION"
const speechTranslationConfig = sdk.SpeechTranslationConfig.fromSubscription(process.env.SPEECH_KEY, process.env.SPEECH_REGION);
speechTranslationConfig.speechRecognitionLanguage = "en-US";

var language = "it";
speechTranslationConfig.addTargetLanguage(language);
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const audioData = Buffer.from(response.data, 'binary');

        // create audio config
        let audioConfig = sdk.AudioConfig.fromWavFileInput(audioData);
     
     let translationRecognizer = new sdk.TranslationRecognizer(speechTranslationConfig, audioConfig);

    translationRecognizer.recognizeOnceAsync(result => {
        switch (result.reason) {
            case sdk.ResultReason.TranslatedSpeech:
                // console.log(`RECOGNIZED: Text=${result.text}`);
                // console.log("Translated into [" + language + "]: " + result.translations.get(language));
                const translation = {
                    originalText:{
                        text: result.text,
                        language: "en-US"
                    }, 
                    translation: {
                        text: result.translations.get(language),
                        language: language
                    }
                }
                res.send(translation).status(200);
                break;
            case sdk.ResultReason.NoMatch:
                // console.log("NOMATCH: Speech could not be recognized.");
                res.send("NOMATCH: Speech could not be recognized.").status(400);
                break;
            case sdk.ResultReason.Canceled:
                const cancellation = sdk.CancellationDetails.fromResult(result);
                // console.log(`CANCELED: Reason=${cancellation.reason}`);
                res.send(`CANCELED: Reason=${cancellation.reason}`).status(499);
                break;
        }
        translationRecognizer.close();
    });
}
catch (error) {
    res.status(500).send('Error retrieving audio file');
}

})


app.listen(3000, () => {
    console.log('Listening on port 3000');
})

