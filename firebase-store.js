import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getDatabase, onValue, ref, update } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-storage.js";

export class FirebaseStore {
  constructor(config) {
    this.app = initializeApp(config);
    this.auth = getAuth(this.app);
    this.db = getDatabase(this.app);
    this.storage = getStorage(this.app);
    this.ready = signInAnonymously(this.auth);
  }

  subscribe(listener) {
    let unsubscribe = () => {};
    this.ready.then(() => {
      unsubscribe = onValue(ref(this.db), (snapshot) => {
        listener(snapshot.val() || { users: {}, teams: {}, notifications: {} });
      });
    });
    return () => unsubscribe();
  }

  async update(patches) {
    await this.ready;
    await update(ref(this.db), patches);
  }

  async uploadFile(teamId, fileId, file) {
    await this.ready;
    const path = `teamFiles/${teamId}/${fileId}/${file.name}`;
    const target = storageRef(this.storage, path);
    await uploadBytes(target, file);
    return {
      url: await getDownloadURL(target),
      fileName: file.name,
      fileSize: file.size,
      fileType: file.name.split(".").pop()?.toLowerCase() || "",
    };
  }
}
