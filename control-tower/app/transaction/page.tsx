"use client";

import { useState } from "react";
import Footer from "../components/Footer";

//  Card Components
import VisualAnalyticsCard from "../components/VisualAnalyticsCard";
// import JA3Card from "../components/cards/JA3Card";
// import SupervisedCard from "../components/cards/SupervisedCard";

type ActiveTab = "unsupervised" | "ja3" | "supervised";

export default function FakeTransactionPage() {
  const [loading, setLoading] = useState(false);

 
  const [result, setResult] = useState<any>(null);

 
  const [vaEvents, setVaEvents] = useState<any[]>([]);
  const [vaStatus, setVaStatus] =
    useState<"idle" | "running" | "done" | "failed">("idle");

  //  UI Tab State
  const [activeTab, setActiveTab] = useState<ActiveTab>("unsupervised");

  //  Form state
  const [form, setForm] = useState({
    source: "",
    target: "",
    amount: "",
  });

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // ======================================================
  // SEND TRANSACTION + START VISUAL-ANALYTICS
  // ======================================================
  const sendTransaction = async () => {
    setLoading(true);

    const transactionData = {
      sourceAccount: form.source,
      targetAccount: form.target,
      amount: Number(form.amount),
    };

    try {
      // 1️⃣ Trigger transaction (AI-Analytics pipeline)
      const txResponse = await fetch("http://localhost:8080/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transactionData),
      });

      if (!txResponse.ok) throw new Error("Transaction Failed");

    
      const data = await txResponse.json();
      setResult({
        risk_score: data.riskScore || 0,
        reasons: [data.verdict || "Processed by AI Engine"],
      });

     
      //  START VISUAL-ANALYTICS (EIF + SHAP)
      
      setVaEvents([]);
      setVaStatus("running");
      setActiveTab("unsupervised"); 

      const es = new EventSource(
        `/visual/stream/unsupervised?nodeId=${form.source}`
      );

      es.onmessage = (event) => {
        const parsed = JSON.parse(event.data);
        setVaEvents((prev) => [...prev, parsed]);

        if (parsed.stage === "unsupervised_completed") {
          setVaStatus("done");
          es.close();
        }
      };

      es.onerror = () => {
        console.error("Visual-Analytics SSE error");
        setVaStatus("failed");
        es.close();
      };

    } catch (error) {
      console.error(error);
      alert("Transaction Failed! Check console.");
      setVaStatus("failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      {/* ================= MAIN ================= */}
      <main className="flex-1 overflow-hidden p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">

          {/* ================= LEFT PANEL ================= */}
          <div className="border border-gray-800 rounded-2xl p-6 bg-[#0A0A0A]">
            <h2 className="text-xl font-bold mb-6">
              Fake Transaction (Graph Edge)
            </h2>

            <div className="flex flex-col gap-4">
              <input
                name="source"
                placeholder="Source Account ID"
                className="bg-gray-900 p-3 rounded-lg border border-gray-700"
                onChange={handleChange}
              />

              <input
                name="target"
                placeholder="Target Account ID"
                className="bg-gray-900 p-3 rounded-lg border border-gray-700"
                onChange={handleChange}
              />

              <input
                name="amount"
                type="number"
                placeholder="Amount (₹)"
                className="bg-gray-900 p-3 rounded-lg border border-gray-700"
                onChange={handleChange}
              />

              <button
                onClick={sendTransaction}
                disabled={loading}
                className="mt-4 bg-[#caff33] hover:bg-[#b8e62e] text-black p-3 rounded-xl font-bold disabled:opacity-50"
              >
                {loading ? "Analyzing..." : "Send Transaction"}
              </button>
            </div>
          </div>

          {/* ================= RIGHT PANEL ================= */}
          <div className="border border-gray-800 rounded-2xl p-6 bg-[#0A0A0A] flex flex-col">
            <h2 className="text-xl font-bold mb-4">
              Investigation Dashboard
            </h2>

            {/*  TAB BANNER */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab("unsupervised")}
                className={`px-3 py-1 rounded-lg text-sm font-semibold ${
                  activeTab === "unsupervised"
                    ? "bg-orange-500 text-black"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                🟠 Unsupervised
              </button>

              <button
                onClick={() => setActiveTab("ja3")}
                className={`px-3 py-1 rounded-lg text-sm font-semibold ${
                  activeTab === "ja3"
                    ? "bg-red-500 text-black"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                🔗 JA3 Fingerprinting
              </button>

              <button
                onClick={() => setActiveTab("supervised")}
                className={`px-3 py-1 rounded-lg text-sm font-semibold ${
                  activeTab === "supervised"
                    ? "bg-blue-500 text-black"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                🔵 Supervised
              </button>
            </div>

            {/* ================= TAB CONTENT ================= */}
            <div className="flex-1 overflow-y-auto">

              {activeTab === "unsupervised" && (
                <VisualAnalyticsCard
                  vaStatus={vaStatus}
                  vaEvents={vaEvents}
                />
              )}

               {activeTab === "ja3"  /* && <JA3Card />} */}

              {activeTab === "supervised" /* && (
                <SupervisedCard result={result} />
              )*/}

            </div>
          </div>
        </div>
      </main>

      {/* ================= FOOTER ================= */}
      <footer className="shrink-0">
        <Footer />
      </footer>
    </div>
  );
}
