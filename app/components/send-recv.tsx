"use client";

import { Card } from "flowbite-react";
import Image from "next/image";
import { CiCirclePlus, CiTrash } from "react-icons/ci";

export default function Component() {
  const handleClick = (
    event: React.MouseEvent<HTMLAnchorElement, MouseEvent>,
  ) => {
    event.preventDefault();
    const element = document.getElementById("transfer-modal");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      element.focus();
    }
  };
  const sendCard = (
    <Card
      className="flex items-start"
      renderImage={() => (
        <Image
          layout="responsive"
          width={500}
          height={500}
          src="/card-bg.jpg"
          alt="image 1"
        />
      )}
    >
      <div
        className="grid h-full grid-cols-1 grid-rows-[auto_1fr_auto]"
        style={{ boxSizing: "border-box" }}
      >
        <div className="h-12">
          <h5 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Send
          </h5>
        </div>

        <div className="overflow-y-auto">
          <p className="py-4 font-normal text-gray-700 dark:text-gray-400">
            Here are the biggest enterprise technology acquisitions of 2021 so
            far, in reverse chronological order.
          </p>
          <div className=" rounded-lg ">
            <div className="space-y-3 rounded-md border border-gray-300 bg-gray-50 p-4">
              <div className="flex items-center justify-between  border-gray-200 pb-2">
                <div>
                  <p className="font-medium">Visa Instructions.pdf</p>
                  <p className="text-sm text-gray-500">11.4MB</p>
                </div>
                <button className="text-gray-500 hover:text-red-500">
                  <CiCirclePlus size={20} />
                </button>
              </div>
            </div>
            <div className="mt-5 justify-items-end">
              <button className="flex items-center font-medium text-blue-600">
                <CiCirclePlus size={30} className="mr-2" />
                Select a file to send
              </button>
            </div>
          </div>
        </div>
        <div className=" mt-8   grid w-full justify-items-end border-t border-gray-300 pt-4">
          <a
            href="#"
            onClick={handleClick}
            className="rounded-md bg-indigo-600 p-8  py-2.5 text-lg font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <div>
              Send
            </div>
          </a>
        </div>
      </div>
    </Card>
  );
  const recvCard = (
    <Card
      className="flex items-start"
      renderImage={() => (
        <Image
          layout="responsive"
          width={500}
          height={500}
          src="/card-bg.jpg"
          alt="image 1"
        />
      )}
    >
      <div
        className="grid h-full grid-cols-1 grid-rows-[auto_1fr_auto]"
        style={{ boxSizing: "border-box" }}
      >
        <div className="h-12">
          <h5 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Receive
          </h5>
        </div>

        <div className="content-start overflow-y-auto">
          <p className="py-4 font-normal text-gray-700 dark:text-gray-400">
            Here are the biggest enterprise technology acquisitions of 2021 so
            far, in reverse chronological order.
          </p>
          <div className=" rounded-lg ">
            <div className="space-y-3 rounded-md border border-gray-300 bg-gray-50 p-4">
              <div className="flex items-center justify-between  border-gray-200 pb-2">
                <div>
                  <p className="font-medium">Visa Instructions.pdf</p>
                  <p className="text-sm text-gray-500">11.4MB, 60% received</p>
                </div>
                <button className="text-gray-500 hover:text-red-500">
                  <CiTrash size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className=" mt-8   grid w-full justify-items-end border-t border-gray-300 pt-4">
          <a
            href="#"
            onClick={handleClick}
            className="rounded-md bg-indigo-600 p-8  py-2.5 text-lg font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <div>
              Receive
            </div>
          </a>
        </div>
      </div>
    </Card>
  );
  return (
    <div className="mt-10 grid grid-cols-1 gap-4 pb-8 sm:grid-cols-2 ">
      {sendCard}
      {recvCard}
    </div>
  );
}
