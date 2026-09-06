export default function BoxMap() {
  return (
    <iframe
      src={`${import.meta.env.BASE_URL}box-map.html`}
      style={{ width: "100%", height: "calc(100vh - 120px)", border: "none", display: "block" }}
      title="Box Map"
    />
  );
}
