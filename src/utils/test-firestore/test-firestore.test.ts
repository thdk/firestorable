import { initTestFirestore } from "../test-firestore";

describe("test-firestore: initTestFirestore", () => {
    const {
        refs: [collectionRef],
        clearFirestoreData,
        deleteFirebaseApp,
    } = initTestFirestore(
        "test-firestore",
        ["books"],
    );

    afterEach(clearFirestoreData);
    beforeAll(async () => {
        await collectionRef.doc("book-1").set({ title: "Book 1" });
    });

    afterAll(deleteFirebaseApp);
    it("should load firestore security rules from specified path", async () => {
        const {
            refs: [collectionRef],
            deleteFirebaseApp,
            clearFirestoreData,
        } = await initTestFirestore(
            "test-firestore",
            ["books"],
            {
                uid: "user-id-1",
                email: "user1@team-timesheets.com",
            },
            "firestore.rules.test",
        );

        await expect(collectionRef.doc("book-1").get()).rejects.toBeDefined();

        await clearFirestoreData();

        deleteFirebaseApp();
    });
});
