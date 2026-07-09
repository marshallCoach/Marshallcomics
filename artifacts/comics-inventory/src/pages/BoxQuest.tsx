export default function BoxQuest() {
  return (
    <iframe
      src={`${import.meta.env.BASE_URL}box-quest.html`}
      style={{ width: "100%", height: "calc(100vh - 120px)", border: "none", display: "block" }}
      title="Box Quest"
    />
  );
}
