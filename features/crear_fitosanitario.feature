Feature: Crear productos fitosanitarios

  Background:
    Given abro WhatsApp Web y el chat "Twilio"

  @fitosanitario
  Scenario: Crear producto fitosanitario por flujo de preguntas
    When inicio el flujo de creación de producto fitosanitario
    And respondo con los datos del producto fitosanitario
    Then el bot confirma la creación del producto fitosanitario