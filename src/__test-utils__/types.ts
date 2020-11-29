export interface IBook {
    name: string;
    total: number;
    isDeleted?: boolean;
    award?: number | undefined;
}

export interface IBookData {
    name: string;
    total: number;
    isDeleted?: boolean;
    award?: null | number;
}
