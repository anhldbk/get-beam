import { Card } from "flowbite-react";
import { IoCloudDownloadOutline, IoCloudUploadOutline } from "react-icons/io5";
import SendCard from "./send-card";
import RecvCard from "./recv-card";
export default function Component() {
  return (
    <Card
      className="mt-12 flex max-w-7xl"
      style={{ marginRight: "auto" }}
    >
      <div>
        <div className="mb-4 border-b border-gray-200 dark:border-gray-700">
          <ul
            className="-mb-px flex w-full flex-wrap items-center justify-center text-sm font-medium"
            id="default-styled-tab"
            data-tabs-toggle="#default-styled-tab-content"
            data-tabs-active-classes="text-purple-600 hover:text-purple-600 dark:text-purple-500 dark:hover:text-purple-500 border-purple-600 dark:border-purple-500"
            data-tabs-inactive-classes="dark:border-transparent text-gray-500 hover:text-gray-600 dark:text-gray-400 border-gray-100 hover:border-gray-300 dark:border-gray-700 dark:hover:text-gray-300"
            role="tablist"
          >
            <li className="me-2 items-center" role="presentation">
              <button
                className="flex items-center rounded-t-lg border-b-2 p-4 text-lg"
                id="profile-styled-tab"
                data-tabs-target="#styled-profile"
                type="button"
                role="tab"
                aria-controls="profile"
                aria-selected="false"
              >
                <IoCloudUploadOutline size={30} className="mr-2" /> Send
              </button>
            </li>
            <li className="me-2 items-center" role="presentation">
              <button
                className="flex items-center rounded-t-lg border-b-2 p-4 text-lg hover:border-gray-300 hover:text-gray-600 dark:hover:text-gray-300"
                id="dashboard-styled-tab"
                data-tabs-target="#styled-dashboard"
                type="button"
                role="tab"
                aria-controls="dashboard"
                aria-selected="false"
              >
                <IoCloudDownloadOutline size={30} className="mr-2" /> Receive
              </button>
            </li>
          </ul>
        </div>
        <div id="default-styled-tab-content">
          <div
            className="hidden rounded-lg dark:bg-gray-800"
            id="styled-profile"
            role="tabpanel"
            aria-labelledby="profile-tab"
          >
            <SendCard />
          </div>
          <div
            className="hidden rounded-lg dark:bg-gray-800"
            id="styled-dashboard"
            role="tabpanel"
            aria-labelledby="dashboard-tab"
          >
            <RecvCard />
          </div>
        </div>
      </div>
    </Card>
  );
}
