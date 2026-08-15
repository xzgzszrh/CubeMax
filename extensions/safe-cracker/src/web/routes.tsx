import { defineRouteOption } from "@buildingai/web-core";

import packageJson from "./../../package.json";
import BoardPage from "./pages/board";
import TeacherPage from "./pages/index";
import StudentPage from "./pages/student";

export const routeOption = defineRouteOption({
    base: `extension/${packageJson.name}`,
    identifier: packageJson.name,
    routes: [
        {
            index: true,
            element: <TeacherPage />,
        },
        {
            path: "student",
            element: <StudentPage />,
        },
        {
            // 宿主的 `/board/safe-cracker/board` 会把这个路由投到教室大屏上，
            // 所以它自己撑满整屏，不套宿主布局。
            path: "board",
            element: <BoardPage />,
        },
    ],
    consoleMenus: [],
    consoleRoutes: [],
});
