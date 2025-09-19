Feature: Asignar precios producto

  Background:
    Given abro WhatsApp Web y el chat "Twilio"

  Scenario: Asignar precio específico a un producto con confirmación
    When inicio el flujo de asignación de precios producto
    And proporciono la información del producto
    Then el bot confirma la asignación de precios