import express from "express";

export const app = express();

app.disable("x-powered-by");
app.use(express.json());
app.use("/api/v1", (_request, response) => {
  response.status(404).end();
});
