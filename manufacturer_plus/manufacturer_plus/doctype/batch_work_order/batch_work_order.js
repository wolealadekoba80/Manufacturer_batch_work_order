// Copyright (c) 2022, Totrox Technology and contributors
// For license information, please see license.txt

frappe.ui.form.on('Batch Work Order', {
	setup: function (frm) {
		// Set query for Sales Orders
		frm.set_query("sales_orders", function () {
			return {
				filters: {
					docstatus: 1,
				}
			};
		});

		// Set query for Cost Center
		frm.set_query("cost_center", function () {
			return {
				filters: {
					is_group: 0,
				}
			};
		});
		frm.set_query("cost_center", "required_items", function () {
			return {
				filters: {
					is_group: 0,
				}
			};
		});

		// Set query for warehouses
		frm.set_query("wip_warehouse", function () {
			return {
				filters: {
					'company': frm.doc.company,
				}
			};
		});

		frm.set_query("source_warehouse", function () {
			return {
				filters: {
					'company': frm.doc.company,
				}
			};
		});

		frm.set_query("source_warehouse", "required_items", function () {
			return {
				filters: {
					'company': frm.doc.company,
				}
			};
		});

		frm.set_query("sales_order", function () {
			return {
				filters: {
					"status": ["not in", ["Closed", "On Hold"]]
				}
			};
		});

		frm.set_query("fg_warehouse", function () {
			return {
				filters: {
					'company': frm.doc.company,
					'is_group': 0
				}
			};
		});

		frm.set_query("scrap_warehouse", function () {
			return {
				filters: {
					'company': frm.doc.company,
					'is_group': 0
				}
			};
		});

		// Set query for BOM
		frm.set_query("bom", "manufacture_items", function () {
			return {
				filters: {
					company: frm.doc.company,
					is_active: 1,
					project: frm.doc.project || '',
					currency: frm.doc.currency,
					rm_cost_as_per: "Valuation Rate",
					docstatus: 1
				}
			};

		});

		// Set query for FG Item
		frm.set_query("project", function () {
			return {
				filters: [
					['Project', 'status', 'not in', 'Completed, Cancelled']
				]
			};
		});


		// formatter for work order operation
		frm.set_indicator_formatter('operation',
			function (doc) { return (frm.doc.qty == doc.completed_qty) ? "green" : "orange"; });
	},

	source_warehouse: function (frm) {
		let transaction_controller = new erpnext.TransactionController();
		transaction_controller.autofill_warehouse(frm.doc.required_items, "source_warehouse", frm.doc.source_warehouse);
	},

	refresh: function (frm, grid_row) {
		erpnext.toggle_naming_series();
		frm.set_intro("");
		frm.fields_dict.required_items.grid.update_docfield_property(
			// changed from 1 to 0
			"transferred_qty", 'read_only', 0
		);
		frm.fields_dict.required_items.grid.update_docfield_property(
			// changed from 1 to 0
			"consumed_qty", 'read_only', 0
		);

		if (frm.doc.status.includes(["Awaiting RM Transfer"])) {
			frm.fields_dict.required_items.grid.update_docfield_property(
				"transferred_qty", 'read_only', 0
			);
			frm.fields_dict.required_items.grid.update_docfield_property(
				// changed from 1 to 0
				"consumed_qty", 'read_only', 0
			);
			refresh_field("required_items");
			frm.refresh_fields();
		}

		if (frappe.user_roles.includes("Stock User") && frm.doc.status == "Awaiting RM Transfer") {
			frm.add_custom_button(__("Create Material Transfer"), () => {
				frappe.call({
					method: "manufacturer_plus.manufacturer_plus.doctype.batch_work_order.batch_work_order.update_status",
					args: {
						work_order_id: frm.doc.name,
						status: "Awaiting Receipt of RM"
					},
					callback: function (r) {
						if (!r.exc) {
							frm.reload_doc();
							frm.refresh();
						}
					}
				});
			});
		}
		if (frappe.user_roles.includes("Manufacturing User") && frm.doc.status == "Awaiting Receipt of RM") {
			frm.add_custom_button(__("Accept Raw Material Transfer"), () => {
				frappe.call({
					method: "manufacturer_plus.manufacturer_plus.doctype.batch_work_order.batch_work_order.make_transfer_stock_entry",
					args: {
						work_order_id: frm.doc.name,
					},
					callback: function (r) {
						if (!r.exc) {
							frm.reload_doc();
							frm.refresh();
						}
					}
				});
			});
		}
		if (frappe.user_roles.includes("Stock User") && frm.doc.status == "Awaiting FG Transfer") {
			frm.add_custom_button(__("Complete Production"), () => {
				frappe.call({
					method: "manufacturer_plus.manufacturer_plus.doctype.batch_work_order.batch_work_order.update_status",
					args: {
						work_order_id: frm.doc.name,
						status: "Awaiting Receipt of FG"
					},
					callback: function (r) {
						if (!r.exc) {
							frm.reload_doc();
							frm.refresh();
						}
					}
				});
			});
		}


		if (frm.doc.status.includes(["Awaiting FG Transfer"])) {
			frm.fields_dict.required_items.grid.update_docfield_property(
				
				"transferred_qty", 'read_only', 1
			);
			frm.fields_dict.required_items.grid.update_docfield_property(
				// changed from 0 to 1
				"consumed_qty", 'read_only', 1
			);
			refresh_field("required_items");
			frm.refresh_fields();
		}

		if (frappe.user_roles.includes("Manufacturing User") && frm.doc.status == "Awaiting Receipt of FG") {
			frm.add_custom_button(__("Accept Finished Goods"), () => {
				frappe.call({
					method: "manufacturer_plus.manufacturer_plus.doctype.batch_work_order.batch_work_order.make_manufacture_entry",
					args: {
						work_order_id: frm.doc.name,
					},
					callback: function (r) {
						if (!r.exc) {
							frm.reload_doc();
							frm.refresh();
						}
					}
				});
			});
		}

		if (frm.doc.docstatus === 0 && !frm.doc.__islocal) {
			frm.set_intro(__("Submit this Work Order for further processing."));
		}
		refresh_field("required_items");
		frm.refresh_fields();
	},

	get_items_from_orders: function (frm) {
		frappe.call({
			method: "set_items_from_orders",
			doc: frm.doc,
			callback: function (r) {
				frm.refresh_field("required_items");
				frm.reload_doc();
			}
		});
	}
});

frappe.ui.form.on("Batch Work Order Required Item", {
	source_warehouse: function (frm, cdt, cdn) {
		var row = locals[cdt][cdn];
		if (!row.item_code) {
			frappe.throw(__("Please set the Item Code first"));
		} else if (row.source_warehouse) {
			frappe.call({
				"method": "erpnext.stock.utils.get_latest_stock_qty",
				args: {
					item_code: row.item_code,
					warehouse: row.source_warehouse
				},
				callback: function (r) {
					frappe.model.set_value(row.doctype, row.name,
						"available_qty_at_source_warehouse", r.message);
				}
			});
		}
	},

	item_code: function (frm, cdt, cdn) {
		let row = locals[cdt][cdn];

		if (row.item_code) {
			frappe.call({
				method: "erpnext.stock.doctype.item.item.get_item_details",
				args: {
					item_code: row.item_code,
					company: frm.doc.company
				},
				callback: function (r) {
					if (r.message) {
						frappe.model.set_value(cdt, cdn, {
							"required_qty": 1,
							"item_name": r.message.item_name,
							"description": r.message.description,
							"source_warehouse": r.message.default_warehouse,
							"allow_alternative_item": r.message.allow_alternative_item,
							"include_item_in_manufacturing": r.message.include_item_in_manufacturing
						});
					}
				}
			});
		}
	}
});


erpnext.work_order = {
	calculate_cost: function (doc) {
		if (doc.operations) {
			var op = doc.operations;
			doc.planned_operating_cost = 0.0;
			for (var i = 0; i < op.length; i++) {
				var planned_operating_cost = flt(flt(op[i].hour_rate) * flt(op[i].time_in_mins) / 60, 2);
				frappe.model.set_value('Work Order Operation', op[i].name,
					"planned_operating_cost", planned_operating_cost);
				doc.planned_operating_cost += planned_operating_cost;
			}
			refresh_field('planned_operating_cost');
		}
	},

	calculate_total_cost: function (frm) {
		let variable_cost = flt(frm.doc.actual_operating_cost) || flt(frm.doc.planned_operating_cost);
		frm.set_value("total_operating_cost", (flt(frm.doc.additional_operating_cost) + variable_cost));
	},

	set_default_warehouse: function (frm) {
		if (!(frm.doc.wip_warehouse || frm.doc.fg_warehouse)) {
			frappe.call({
				method: "erpnext.manufacturing.doctype.work_order.work_order.get_default_warehouse",
				callback: function (r) {
					if (!r.exe) {
						frm.set_value("wip_warehouse", r.message.wip_warehouse);
						frm.set_value("fg_warehouse", r.message.fg_warehouse);
						frm.set_value("scrap_warehouse", r.message.scrap_warehouse);
					}
				}
			});
		}
	},

};
