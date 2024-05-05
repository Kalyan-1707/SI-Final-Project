const sdk = require("microsoft-cognitiveservices-speech-sdk");
const fs = require("fs");
const express = require('express');
const app = express();



// This example requires environment variables named "SPEECH_KEY" and "SPEECH_REGION"
const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.SPEECH_KEY, process.env.SPEECH_REGION);
speechConfig.speechRecognitionLanguage = "en-US";

async function fromFile(URL) {
   
}



app.get('/transcribe', (req, res) => {
    
    const url = './audio_files/Why Reading (Books).wav';
    let audioConfig = sdk.AudioConfig.fromWavFileInput(fs.readFileSync(url));
    let speechRecognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    console.log('in prgoess');

    speechRecognizer.recognizeOnceAsync(result => {
        switch (result.reason) {
            case sdk.ResultReason.RecognizedSpeech:
                console.log("RECOGNIZED: Text=" + result.text);
                res.send(`RECOGNIZED: Text=${result.text}`);
                
            case sdk.ResultReason.NoMatch:
               res.send("NOMATCH: Speech could not be recognized.");
                
            case sdk.ResultReason.Canceled:
                const cancellation = sdk.CancellationDetails.fromResult(result);
                res.send(`CANCELED: Reason=${cancellation.reason}`); 
        }
        speechRecognizer.close();
    });
    
})

app.listen(3000, () => {
    console.log('Listening on port 3000');
})

