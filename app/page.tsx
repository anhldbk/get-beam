"use client";
import Header from "./components/header";
import Footer from "./components/footer";
import Main from "./components/main";
import { useEffect } from "react";

export default function Component() {
  useEffect(() => {
    import("flowbite").then((module) => module.initFlowbite());
  });
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <Main className="flex-1" />
      <Footer />
    </div>
  );
}
