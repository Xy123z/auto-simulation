import YouTube from "youtube-sr";
import youtubedl from "youtube-dl-exec";
import path from "path";
import fs from "fs";
import readline from "readline";
import { exec } from "child_process";
import ffmpegPath from "ffmpeg-static";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ffmpegDir = path.dirname(ffmpegPath as string);

// ---------- CHANGE THIS IF YOU MANUALLY DOWNLOADED yt-dlp ----------
const YT_DLP_PATH = "C:\\yt-dlp\\yt-dlp.exe";   // ← set this path
// ------------------------------------------------------------------

async function searchAndPlay(songName: string) {
  try {
    console.log(`\n🔍 Searching for: "${songName}"...`);

    const results = await YouTube.search(songName, { limit: 5, type: "video" });

    if (!results.length) {
      console.log("❌ No results found.");
      return askAgain();
    }

    console.log("\nTop results:");
    results.forEach((video, i) => {
      console.log(`${i + 1}. ${video.title} (${video.durationFormatted})`);
    });

    const video = results[0];
    console.log(`\n✅ Selected: ${video.title}`);
    console.log(`🔗 ${video.url}`);

    const downloadDir = path.join(process.cwd(), "downloads");
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir);
    }

    // Clean filename (remove invalid characters)
    const safeTitle = video.title
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 80);

    const outputFile = path.join(downloadDir, `${safeTitle}.mp3`);

    console.log("\n⬇ Downloading & converting to MP3...");

    // Build options
    const options: any = {
      extractAudio: true,
      audioFormat: "mp3",
      audioQuality: 0,                // best quality
      output: outputFile,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      ffmpegLocation: ffmpegDir,
      addHeader: ["referer:youtube.com", "user-agent:Mozilla/5.0"],
    };

    // Use custom yt-dlp if the file exists
    if (fs.existsSync(YT_DLP_PATH)) {
      options.binaryPath = YT_DLP_PATH;
      console.log("Using custom yt-dlp binary");
    }

    await youtubedl(video.url, options);

    // Verify file
    let finalPath = outputFile;
    if (!fs.existsSync(outputFile)) {
      // Sometimes the name is slightly different
      const files = fs
        .readdirSync(downloadDir)
        .filter((f) => f.toLowerCase().endsWith(".mp3"))
        .map((f) => ({
          name: f,
          time: fs.statSync(path.join(downloadDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);

      if (!files.length) {
        console.log("❌ MP3 file not found after download.");
        return askAgain();
      }
      finalPath = path.join(downloadDir, files[0].name);
    }

    console.log(`\n✅ Downloaded: ${path.basename(finalPath)}`);
    playAudio(finalPath);
  } catch (error: any) {
    console.error("\n❌ Error:", error.message || error);
    askAgain();
  }
}

function playAudio(filePath: string) {
  console.log("🎵 Opening with default player...\n");

  exec(`start "" "${filePath}"`, (error) => {
    if (error) {
      console.error("Failed to open player:", error.message);
      console.log(`\nFile saved at:\n${filePath}`);
    } else {
      console.log("🎵 Song opened in your default music player!");
    }
    askAgain();
  });
}

export function askAgain() {
  rl.question("\nEnter song name (or 'exit'): ", (answer) => {
    const input = answer.trim();
    if (input.toLowerCase() === "exit") {
      rl.close();
      process.exit(0);
    }
    if (input) {
      searchAndPlay(input);
    } else {
      askAgain();
    }
  });
}
