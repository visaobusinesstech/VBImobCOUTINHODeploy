import { styled } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";

/**
 * Shell mobile de /tickets — preenche o espaço sob a AppBar (flex)
 * para a lista de mensagens rolar internamente (padrão WhatsApp).
 */
const TicketAdvancedLayout = styled(Paper)({
  flex: "1 1 0%",
  minHeight: 0,
  height: 0,
  width: "100%",
  maxWidth: "100%",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  overflowX: "hidden",
  background: "transparent",
  boxShadow: "none",
  borderRadius: 0,
  boxSizing: "border-box",
});

export default TicketAdvancedLayout;
