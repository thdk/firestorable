import { initDatabase, deleteFirebaseApps } from "../utils/firestore-utils";
import { waitFor } from "@testing-library/dom";

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

const { collectionRef, clearFirestoreDataAsync } = initDatabase("test-document-watch", "books");

const dummyBook = {
    name: "book a",
    award: null,
};

const createDoc = (watch: boolean, id?: string) => {
    return new Doc<IBook, IBookData>(collectionRef, dummyBook, {
        deserialize: deserializeBook,
        watch,
    }, id);
};

beforeEach(() => clearFirestoreDataAsync());

afterAll(deleteFirebaseApps);

describe("Document.watch", () => {
    beforeEach(() => {
        return collectionRef.doc("id-A").set(dummyBook);
    });

    describe("when watch = true", () => {
        let doc: Doc<IBook, IBookData>;

        beforeEach(() => {
            doc = createDoc(true, "id-A");
        });

        describe("when document gets deleted in the database", () => {
            it("should set data property of document to undefined", async () => {
                await collectionRef.doc("id-A")
                    .delete();

                await waitFor(() => expect(doc.data).toBe(undefined));
            });
        });

        describe("when document is updated in database", () => {
            test("it should respond to changes", () => {
                return collectionRef.doc("id-A")
                    .set({
                        award: 3,
                    })
                    .then(() => {
                        return waitFor(() => expect(doc.data!.award).toBe(3));
                    });
            });
        });

        describe("when unwatch() is called on document", () => {
            test("it should not respond to changes anymore", () => {
                doc.unwatch();

                return collectionRef.doc("id-A")
                    .set({
                        award: 3,
                    })
                    .then(() => {
                        expect(doc.data?.award).toBe(undefined);
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
