# DramaBoxBypass

A Node.js utility to bypass DramaBox video restrictions and play them smoothly without limitations. It communicates with the third-party api hosting system at `https://api.hoshiyomi.my.id/` to handle source stream translation.

## Features

* **Stream Retrieval Engine:** Built on Express with dedicated endpoints for resolving dynamic video links.
* **M3U8 Parser & Playback:** Seamlessly recovers and prepares raw HLS playlist manifests for instant playback.
* **Streamlined Core:** Zero complex configuration setups or environment files (`.env`) required.

---

## Prerequisites

Before running the application, make sure you have the following ready:

1. **Drama ID:** The identifier code of the specific drama collection you intend to fetch. This is normally on the url, example: https://www.dramabox.com/drama/################/name-of-the-drama being "################" a bunch of numbers that are the ID.
2. **API Access Key:** A valid personal-use API authorization key requested from the provider ecosystem, you can requested via telegram and the GUI already has a link for it.

---

## Quick Start & Installation

First we need to install the dependencies:

```bash
pnpm install
```

Once that command finish, we ran the server  
```bash
npm start
```

The server should run on:
```bash
http:\\localhos:3000
```
