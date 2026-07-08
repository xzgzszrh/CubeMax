import type { VOData } from "@flowgram.ai/runtime-interface";

export const arrayVOData = <T>(arr: T[]): Array<VOData<T>> =>
    arr.map((item: any) => {
        const { id, ...data } = item;
        return data;
    });
