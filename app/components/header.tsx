"use client";

import Link from "next/link";
import Image from "next/image";
import { Navbar } from "flowbite-react";

export default function Component() {
  const homepage = "https://get-beam.vercel.app/";
  return (
    <Navbar fluid rounded>
      <Navbar.Brand as={Link} href={homepage}>
        <Image src="/beam.png" width={36} height={36} className="mr-3 sm:h-9" alt="Beam Logo" />
        <span className="self-center whitespace-nowrap text-xl font-semibold dark:text-white">
          Beam
        </span>
      </Navbar.Brand>
      <Navbar.Toggle />
      <Navbar.Collapse>
        <Navbar.Link as={Link} href={homepage} >
          Home
        </Navbar.Link>
        <Navbar.Link as={Link} href="https://github.com/anhldbk/get-beam" target="_blank">
          GitHub
        </Navbar.Link>
        <Navbar.Link as={Link} href="/about">
          About
        </Navbar.Link>
      </Navbar.Collapse>
    </Navbar >
  );
}
