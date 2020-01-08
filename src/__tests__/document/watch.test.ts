import { initDatabase, deleteFirebaseAppsAsync } from "../utils/firestore-utils";
import { waitAsync } from "../utils";

import { Doc } from "../..";

interface IBook {
    name: string;
    award?: number | undefined;
}

interface IBookData {
    name: string;
    award?: null | number;
}

function deserializeBook(book: IBookData): IBook {
    const { award, ...otherProps } = book;
    const newValue = award === null || award === undefined
        ? undefined
        : award;

    return { ...otherProps, award: newValue };
}

const { db, collectionRef, clearFirestoreDataAsync } = initDatabase("test-add-documents", "books");

const dummyBook = {
    name: "book a",
    award: null,
};

const createDoc = (watch: boolean) => {
    return new Doc<IBook, IBookData>(db.collection("books"), dummyBook, {
        deserialize: deserializeBook,
        watch,
    });
};

beforeEach(() => clearFirestoreDataAsync());

afterAll(deleteFirebaseAppsAsync);

describe("Document.watch", () => {
    beforeEach(() => {
        return collectionRef.doc("id-A").set(dummyBook);
    });

    describe("when watch = true", () => {
        let doc: Doc<IBook, IBookData>;

        beforeEach(() => {
            doc = createDoc(true);
        });

        describe("when document gets deleted in the database", () => {
            it("should set data property of document to undefined", () => {
                return collectionRef.doc("id-A")
                    .delete()
                    .then(() => waitAsync(50))
                    .then(() => {
                        expect(doc.data).toBe(undefined);
                    });
            });
        });
    });

    describe("when watch = false", () => {
        let doc: Doc<IBook, IBookData>;

        beforeEach(() => {
            doc = createDoc(false);
        });

        describe("when document gets deleted in the database", () => {
            it("should NOT set data property of document to undefined", () => {
                return collectionRef.doc("id-A")
                    .delete()
                    .then(() => waitAsync(50))
                    .then(() => {
                        expect(doc.data).toEqual({
                            name: "book a",
                            award: undefined,
                        });
                    });
            });
        });
    });
});
