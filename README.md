# TestPal: QA Chatbot

A chatbot that answers software testing and QA questions. It is a retrieval chatbot: it ranks its knowledge base with TF-IDF weighting and cosine similarity, shows how confident it is, and says when it is not sure.

**Live demo:** https://dustinclarence.github.io/qa-chatbot/

## Features

- 28 testing topics (test cases, bug reports, severity vs priority, regression, automation and more)
- Confidence score and related-topic suggestions
- Typing indicator and small talk
- No API key and no external AI service: runs fully in the browser

## AI techniques

TF-IDF, cosine similarity, synonyms and stemming, confidence threshold

## Built with

HTML, CSS and vanilla JavaScript. No frameworks, no build step and no external AI service. Everything runs in the browser. Built with the help of AI coding tools.

## Run locally

Open `index.html` through any static server, for example:

```bash
npx serve .
```
