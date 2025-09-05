Feature: Listar fertilizantes

  Background:
    Given abro WhatsApp Web y el chat "Twilio"

  Scenario: Listar fertilizantes
    When envio el comando para listar fertilizantes
    Then la lista del bot contiene fertilizantes
