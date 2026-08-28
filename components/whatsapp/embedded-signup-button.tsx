"use client";

import { useState } from "react";

import {
  createFacebookSdkCallback,
  createMetaAssetCollector,
} from "@/lib/meta/facebook-sdk-callback";

type FacebookResponse = { authResponse?: { code?: string } };
type FacebookSdk = {
  init(config: {
    appId: string;
    cookie: boolean;
    xfbml: boolean;
    version: string;
  }): void;
  login(
    callback: (response: FacebookResponse) => void,
    options: Record<string, unknown>,
  ): void;
};

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

async function loadSdk(appId: string) {
  if (window.FB) return window.FB;
  await new Promise<void>((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, cookie: true, xfbml: false, version: "v26.0" });
      resolve();
    };
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.onerror = () => reject(new Error("meta_sdk_unavailable"));
    document.body.appendChild(script);
  });
  if (!window.FB) throw new Error("meta_sdk_unavailable");
  return window.FB;
}

export function EmbeddedSignupButton() {
  const [status, setStatus] = useState<
    "idle" | "connecting" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function connect() {
    setStatus("connecting");
    setMessage("Opening Meta securely…");
    try {
      const stateResponse = await fetch("/api/meta/whatsapp/signup-state", {
        method: "POST",
      });
      const stateBody = (await stateResponse.json()) as {
        state?: string;
        appId?: string;
        configurationId?: string;
        error?: { message?: string };
      };
      if (
        !stateResponse.ok ||
        !stateBody.state ||
        !stateBody.appId ||
        !stateBody.configurationId
      )
        throw new Error(
          stateBody.error?.message ?? "WhatsApp onboarding is unavailable.",
        );
      const assetCollector = createMetaAssetCollector();
      const listener = (event: MessageEvent) => {
        if (
          event.origin !== "https://www.facebook.com" &&
          event.origin !== "https://web.facebook.com"
        )
          return;
        try {
          const value =
            typeof event.data === "string"
              ? (JSON.parse(event.data) as unknown)
              : event.data;
          if (!value || typeof value !== "object") return;
          const record = value as {
            type?: string;
            event?: string;
            data?: { waba_id?: string; phone_number_id?: string };
          };
          if (
            record.type === "WA_EMBEDDED_SIGNUP" &&
            (record.event === "FINISH" || record.event === "FINISH_ONLY_WABA")
          )
            assetCollector.record({
              wabaId: record.data?.waba_id,
              phoneNumberId: record.data?.phone_number_id,
            });
        } catch {
          /* Ignore unrelated cross-window messages. */
        }
      };
      window.addEventListener("message", listener);
      let sdk: FacebookSdk;
      try {
        sdk = await loadSdk(stateBody.appId);
      } catch (error) {
        window.removeEventListener("message", listener);
        throw error;
      }
      const completeSignup = async (response: FacebookResponse) => {
        try {
          const code = response.authResponse?.code;
          const assets = code ? await assetCollector.wait() : undefined;
          if (!code || !assets) {
            setStatus("error");
            setMessage(
              "Meta did not return a complete WhatsApp connection. You can safely try again.",
            );
            return;
          }
          const completed = await fetch("/api/meta/whatsapp/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              state: stateBody.state,
              code,
              wabaId: assets.wabaId,
              phoneNumberId: assets.phoneNumberId,
            }),
          });
          const completedBody = (await completed.json()) as {
            error?: { message?: string };
          };
          if (!completed.ok) {
            setStatus("error");
            setMessage(
              completedBody.error?.message ??
                "The WhatsApp connection could not be completed.",
            );
            return;
          }
          setStatus("success");
          setMessage(
            "WhatsApp is connected. Refresh this page to view its status.",
          );
        } finally {
          window.removeEventListener("message", listener);
        }
      };
      sdk.login(
        createFacebookSdkCallback(completeSignup, () => {
          window.removeEventListener("message", listener);
          setMessage(
            "The WhatsApp connection could not be completed. You can safely try again.",
          );
          setStatus("error");
        }),
        {
          config_id: stateBody.configurationId,
          response_type: "code",
          override_default_response_type: true,
          extras: { setup: {}, sessionInfoVersion: "3" },
          state: stateBody.state,
        },
      );
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error && error.message !== "meta_sdk_unavailable"
          ? error.message
          : "Meta could not open the secure connection window. Refresh the page and try again.",
      );
    }
  }

  return (
    <div className="stack-actions">
      <button
        className="button-primary"
        disabled={status === "connecting"}
        onClick={connect}
        type="button"
      >
        {status === "connecting" ? "Connecting…" : "Connect WhatsApp with Meta"}
      </button>
      {message ? (
        <p
          aria-live="polite"
          className={status === "error" ? "form-error" : "muted"}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
