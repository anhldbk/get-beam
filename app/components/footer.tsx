"use client";

import { Footer } from "flowbite-react";
export default function Component() {
  return (
    <Footer container>
      <div className="w-full">

        <Footer.Divider />
        <div className="w-full sm:flex sm:items-center sm:justify-between">
          <div className="mb-4 sm:mb-0">
            <Footer.Brand
              href="https://get-beam.vercel.app/"
              src="/beam.png"
              alt="Beam Logo"
              name="Beam"
            />
          </div>
          <div className="whitespace-nowrap">
            <Footer.Copyright href="#" by="Beam™" year={2025} />
          </div>
        </div>
      </div>
    </Footer>
  );
}
