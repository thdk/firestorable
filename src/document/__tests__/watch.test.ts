import { clearFirestoreData, initializeTestApp } from "@firebase/rules-unit-testing";
import { waitFor } from "@testing-library/dom";

import { Doc } from "../..";
import { IBook, IBookData } from "../../__test-utils__";

function deserializeBook(book: IBookData): IBook {
    const { award, ...otherProps } = book;
    const newValue = award === null || award === undefined
        ? undefined
        : award;

    return { ...otherProps, award: newValue };
}

const projectId = "test-document-watch";

const app = initializeTestApp({
    projectId,
});

const firestore = app.firestore();

const collectionRef = firestore.collection("books");

const dummyBook = {
    total: 5,
    name: "book a",
    award: null,
};

const createDoc = (watch: boolean, id?: string) => {
    return new Doc<IBook, IBookData>(collectionRef, dummyBook, {
        deserialize: deserializeBook,
        watch,
    }, id);
};

beforeEach(() => clearFirestoreData({projectId}));

afterAll(() => app.delete());

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
                            total: 5,
                        });
                    });
            });
        });
    });
});
