import "@fontsource/roboto";
import { fs } from "@tauri-apps/api";
import { message as dialogMessage } from "@tauri-apps/api/dialog";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import { appWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import "./App.css";
import successSound from "./assets/success.wav";
import AudioInput from "./components/AudioInput";
import LanguageInput from "./components/LanguageInput";
import TextArea from "./components/TextArea";
import ThemeToggle from "./components/ThemeToggle";
import * as transcript from "./transcript";

function App() {
  const [path, setPath] = useState("");
  const [modelExists, setModelExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] =
    useState<transcript.Transcript>();
  const [lang, setLang] = useState("");
  const [progress, setProgress] = useState(0);
  const [downloadProgress, setDownloadProgress] =
    useState(0);

  useEffect(() => {
    async function handleEvents() {
      await listen("transcribe_progress", (event) => {
        // event.event is the event name (useful if you want to use a single callback fn for multiple event types)
        // event.payload is the payload object
        setProgress(event.payload as number);
      });
    }
    handleEvents();
  }, []);

  useEffect(() => {
    async function checkModelExists() {
      const path: string = await invoke("get_model_path");
      const exists = await fs.exists(path);
      setModelExists(exists);
      if (!exists) {
        await listen("download_progress", (event) => {
          // event.event is the event name (useful if you want to use a single callback fn for multiple event types)
          // event.payload is the payload object
          const [current, total] = event.payload as [
            number,
            number
          ];
          const newDownloadProgress =
            Number(current / total) * 100;
          if (newDownloadProgress > downloadProgress) {
            // for some reason it jumps if not
            setDownloadProgress(newDownloadProgress);
          }
        });
        try {
          await invoke("download_model");
        } catch (e: any) {
          console.error(e);
          await dialogMessage(e?.toString(), {
            title: "Error",
            type: "error",
          });
        }
        setModelExists(true);
        setDownloadProgress(0);
      } else {
        console.log("found model in ", path);
      }
    }
    checkModelExists();
  }, []);

  async function transcribe() {
    setLoading(true);
    try {
      const res: transcript.Transcript = await invoke(
        "transcribe",
        { path, lang }
      );
      setLoading(false);
      setProgress(0);
      new Audio(successSound).play();
      setTranscript(res);
      setPath("");
    } catch (e: any) {
      console.error("error: ", e);
      await dialogMessage(e?.toString(), {
        title: "Error",
        type: "error",
      });
      setLoading(false);
      setPath("");
    } finally {
      appWindow.unminimize();
      appWindow.setFocus();
    }
  }

  if (!modelExists) {
    return (
      <div className="w-[100vw] h-[100vh] flex flex-col justify-center items-center">
        <div className="absolute right-16 top-16">
          <ThemeToggle />
        </div>
        <div className="text-3xl m-5 font-bold">
          Downloading OpenAI Model...
        </div>
        {downloadProgress > 0 && (
          <>
            <progress
              className="progress progress-primary w-56 my-2"
              value={downloadProgress}
              max="100"></progress>
            <p className="text-neutral-content">
              This happens only once! 🎉
            </p>
          </>
        )}
        {downloadProgress === 0 && (
          <span className="loading loading-spinner loading-lg"></span>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-[100vw] h-[100vh] flex flex-col justify-center items-center">
        <div className="absolute right-16 top-16">
          <ThemeToggle />
        </div>
        <div className="text-3xl m-5 font-bold">
          Transcribing...
        </div>
        {progress > 0 && (
          <>
            <progress
              className="progress progress-primary w-56 my-2"
              value={progress}
              max="100"></progress>
            <p className="text-neutral-content">
              You'll receive a notification when it's done!
              🎉
            </p>
          </>
        )}
        {progress === 0 && (
          <span className="loading loading-spinner loading-lg"></span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col m-auto w-[300px] mt-10">
        <h1 className="text-center text-4xl mb-10">
          Vibe!
        </h1>
        <div className="absolute right-16 top-16">
          <ThemeToggle />
        </div>
        <LanguageInput onChange={(lang) => setLang(lang)} />
        <AudioInput
          onChange={(newPath) => setPath(newPath)}
        />
        {path && (
          <button
            onClick={transcribe}
            className="btn btn-primary">
            Transcribe
          </button>
        )}
      </div>
      {transcript && (
        <div className="flex flex-col mt-20 items-center w-[60%] max-w-[1000px] h-[70vh] max-h-[600px] m-auto">
          <TextArea transcript={transcript} />
        </div>
      )}
    </div>
  );
}

export default App;
